const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../db/connection');
const OpenAI = require('openai');

// 初始化 OpenAI 客户端（兼容 MiMo API）
const openai = new OpenAI({
  apiKey: process.env.MIMO_API_KEY,
  baseURL: process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1'
});

const MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro';

// 数据库 Schema 描述
const DB_SCHEMA = `
数据库表结构（SQLite）：

1. stores (门店表)
   - store_id: TEXT (主键, 如 S01, S02...)
   - store_name: TEXT (门店名称)
   - category: TEXT (品类: 拉面/轻食/点心/三明治/日料)
   - district: TEXT (区域)

2. products (商品表)
   - product_id: TEXT (主键, 如 P01, P02...)
   - product_name: TEXT (商品名称)
   - product_category: TEXT (品类: 主食/点心/小食/饮料)
   - unit_price: REAL (单价)

3. sales (销售表)
   - order_id: TEXT (主键)
   - date: TEXT (日期, 格式 YYYY-MM-DD, 数据范围 2026年)
   - store_id: TEXT (外键, 关联 stores)
   - product_id: TEXT (外键, 关联 products)
   - qty: INTEGER (数量)
   - amount: REAL (金额)
   - payment: TEXT (支付方式: 现金/微信/支付宝/银行卡/会员储值)
`;

// 系统提示词
const SYSTEM_PROMPT = `你是 Moneki 连锁餐饮公司的数据分析助手。你的任务是理解用户关于销售数据的问题，并生成对应的 SQLite 查询语句。

## 数据库结构
${DB_SCHEMA}

## 你可以回答的问题类型
- 营业额相关：总营业额、某月营业额、各门店/品类营业额、营业额排名
- 销量相关：商品销量、销量排名、热销商品
- 门店相关：门店排名、门店对比、各门店业绩
- 商品相关：商品销售情况、特定商品查询、品类分析
- 趋势分析：客单价变化、销售趋势
- 支付方式：各支付方式占比
- 任何与上述销售数据相关的分析问题

## 问题处理规则
1. **问候语**（你好、hi、hello等）：返回欢迎消息，is_data_question: true，sql: null
2. **数据相关问题**：生成SQL查询，is_data_question: true
3. **完全无关问题**（天气、政治、闲聊等非数据非问候）：返回拒绝消息，is_data_question: false

## 严格限制
- 只生成 SELECT 查询语句
- 只查询上述三个表

## 回复格式
严格按以下 JSON 格式回复，只返回 JSON，不要有其他内容：

对于数据相关问题：
{"sql": "SELECT ... FROM ... WHERE ...", "description": "查询说明", "is_data_question": true}

对于完全无关的问题：
{"sql": null, "description": "抱歉，我只能回答与餐饮销售数据相关的问题。", "is_data_question": false}

注意：
- 日期格式 YYYY-MM-DD，数据范围是 2026 年
- 金额单位为元
- SQL 必须语法正确`;

// 调用大模型生成 SQL
async function generateSQLWithAI(question) {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: question }
      ],
      temperature: 0.1, // 低温度，确保输出稳定
      max_tokens: 500
    });

    const responseContent = completion.choices[0].message.content;
    
    // 尝试解析 JSON 响应
    try {
      // 提取 JSON 部分（处理可能的 markdown 代码块）
      let jsonStr = responseContent;
      const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      // 尝试提取 JSON 对象
      const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }
      
      const result = JSON.parse(jsonStr.trim());
      return result;
    } catch (parseError) {
      console.error('解析 AI 响应失败:', parseError);
      console.error('原始响应:', responseContent);
      return {
        sql: null,
        description: '抱歉，AI 响应格式错误，请重试。',
        is_data_question: false
      };
    }
  } catch (error) {
    console.error('调用 AI API 失败:', error);
    throw error;
  }
}

// 格式化查询结果为自然语言回答
async function formatAnswerWithAI(question, queryResult, sqlDescription) {
  if (!queryResult || queryResult.length === 0) {
    return '根据查询，没有找到符合条件的数据。';
  }

  try {
    const formatPrompt = `用户问题：${question}
    
查询说明：${sqlDescription}

查询结果数据：
${JSON.stringify(queryResult, null, 2)}

请根据以上信息，用简洁自然的中文回答用户的问题。要求：
1. 直接回答问题，不要重复问题本身
2. 如果是排名类数据，用列表格式展示
3. 金额保留两位小数，使用千分位格式
4. 回答要专业、准确、简洁`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { 
          role: 'system', 
          content: '你是一个数据分析助手，请根据查询结果用简洁的中文回答用户问题。只返回回答内容，不要有其他格式。' 
        },
        { role: 'user', content: formatPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('格式化回答失败:', error);
    // 降级处理：返回原始数据
    return `查询结果：\n${JSON.stringify(queryResult, null, 2)}`;
  }
}

// 检测是否是问候语
function isGreeting(text) {
  const greetings = ['你好', '您好', 'hi', 'hello', '嗨', 'hey', '早上好', '下午好', '晚上好', '在吗'];
  const lowerText = text.toLowerCase().trim();
  return greetings.some(g => lowerText.includes(g)) || lowerText.length <= 2;
}

// 问候语欢迎消息
const WELCOME_MESSAGE = '您好！我是 Moneki 连锁餐饮公司的数据分析助手。我可以帮您查询：\n- 营业额统计（总营业额、月度营业额、品类营业额）\n- 商品销量（热销商品、特定商品查询）\n- 门店业绩（门店排名、门店对比）\n- 支付方式分析\n- 客单价趋势\n\n请问有什么可以帮您的？';

// POST /api/ai/chat - 处理 AI 问答
router.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ success: false, error: '请输入问题' });
    }
    
    // 检测问候语，直接返回欢迎消息
    if (isGreeting(question)) {
      return res.json({
        success: true,
        data: {
          answer: WELCOME_MESSAGE,
          sql: null,
          data: null
        }
      });
    }
    
    // 使用大模型生成 SQL
    const aiResult = await generateSQLWithAI(question);
    
    if (!aiResult.is_data_question || !aiResult.sql) {
      return res.json({
        success: true,
        data: {
          answer: aiResult.description,
          sql: null,
          data: null
        }
      });
    }
    
    // 执行查询
    const results = await query(aiResult.sql);
    
    // 使用大模型格式化回答
    const answer = await formatAnswerWithAI(question, results, aiResult.description);
    
    res.json({
      success: true,
      data: {
        answer: answer,
        sql: aiResult.sql,
        desc: aiResult.description,
        rawData: results
      }
    });
  } catch (error) {
    console.error('AI 问答处理失败：', error);
    res.status(500).json({ 
      success: false, 
      error: '处理问题时出错，请稍后重试' 
    });
  }
});

module.exports = router;
