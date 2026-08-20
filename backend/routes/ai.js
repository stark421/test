const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../db/connection');
const OpenAI = require('openai');

// 懒加载 OpenAI 客户端（避免缺 API Key 时模块加载崩溃）
let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.MIMO_API_KEY,
      baseURL: process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1'
    });
  }
  return openai;
}

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

// 调用大模型生成 SQL（支持对话上下文）
async function generateSQLWithAI(question, conversationHistory = []) {
  try {
    // 构建消息数组，包含系统提示和对话历史
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];
    
    // 添加对话历史（最多保留最近5轮对话）
    const recentHistory = conversationHistory.slice(-5);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
    
    // 添加当前问题
    messages.push({ role: 'user', content: question });
    
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages: messages,
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
4. 回答要专业、准确、简洁
5. 如果数据是时间序列（如各月数据），请按时间顺序列出趋势`;

    const completion = await getOpenAI().chat.completions.create({
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

    const answer = completion.choices[0].message.content;
    console.log('AI格式化回答:', answer);
    
    // 确保返回有效的字符串
    if (!answer || answer.trim().length === 0) {
      console.error('AI返回空回答，使用降级处理');
      return formatFallbackAnswer(queryResult, sqlDescription);
    }
    
    return answer;
  } catch (error) {
    console.error('格式化回答失败:', error);
    // 降级处理：返回格式化的原始数据
    return formatFallbackAnswer(queryResult, sqlDescription);
  }
}

// 流式格式化查询结果
async function formatAnswerWithAIStream(question, queryResult, sqlDescription, res) {
  if (!queryResult || queryResult.length === 0) {
    res.write(`data: ${JSON.stringify({ type: 'content', content: '根据查询，没有找到符合条件的数据。' })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    return;
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
4. 回答要专业、准确、简洁
5. 如果数据是时间序列（如各月数据），请按时间顺序列出趋势`;

    const stream = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages: [
        { 
          role: 'system', 
          content: '你是一个数据分析助手，请根据查询结果用简洁的中文回答用户问题。只返回回答内容，不要有其他格式。' 
        },
        { role: 'user', content: formatPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: true
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
      }
    }
    
    console.log('AI流式回答完成:', fullContent);
    
    // 如果流式输出为空，使用降级处理
    if (!fullContent || fullContent.trim().length === 0) {
      const fallbackAnswer = formatFallbackAnswer(queryResult, sqlDescription);
      res.write(`data: ${JSON.stringify({ type: 'content', content: fallbackAnswer })}\n\n`);
    }
    
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (error) {
    console.error('流式格式化回答失败:', error);
    // 降级处理
    const fallbackAnswer = formatFallbackAnswer(queryResult, sqlDescription);
    res.write(`data: ${JSON.stringify({ type: 'content', content: fallbackAnswer })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  }
}

// 降级回答格式化
function formatFallbackAnswer(queryResult, sqlDescription) {
  if (!queryResult || queryResult.length === 0) {
    return '根据查询，没有找到符合条件的数据。';
  }
  
  // 如果只有一行一列，直接返回值
  if (queryResult.length === 1) {
    const keys = Object.keys(queryResult[0]);
    if (keys.length === 1) {
      const value = queryResult[0][keys[0]];
      return `${sqlDescription}：${typeof value === 'number' ? value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}`;
    }
  }
  
  // 多行数据，格式化为列表
  let result = `${sqlDescription}：\n`;
  queryResult.forEach((row, index) => {
    const values = Object.values(row);
    const formattedValues = values.map(v => 
      typeof v === 'number' ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v
    );
    result += `${index + 1}. ${formattedValues.join(' - ')}\n`;
  });
  
  return result;
}

// 检测是否是问候语
function isGreeting(text) {
  const greetings = ['你好', '您好', 'hi', 'hello', '嗨', 'hey', '早上好', '下午好', '晚上好', '在吗', '你是谁', '你是'];
  const lowerText = text.toLowerCase().trim();
  //精确匹配问候语，不再使用 length <= 2的宽泛判断
  return greetings.some(g => lowerText === g || lowerText.startsWith(g + ' ') || lowerText.endsWith(' ' + g));
}

// SQL安全校验 - 只允许SELECT语句
function validateSQL(sql) {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, error: 'SQL语句为空' };
  }
  
  const trimmedSQL = sql.trim().toUpperCase();
  
  // 检查是否以SELECT开头
  if (!trimmedSQL.startsWith('SELECT')) {
    return { valid: false, error: '只允许SELECT查询语句' };
  }
  
  // 检查是否包含危险关键词
  const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE', 'UNION', 'INTO', 'OUTFILE', 'DUMPFILE'];
  for (const keyword of dangerousKeywords) {
    // 使用单词边界匹配，避免误匹配（如SELECT中的"LECT"）
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      return { valid: false, error: `SQL语句包含不允许的关键词: ${keyword}` };
    }
  }
  
  return { valid: true };
}

// 问候语欢迎消息
const WELCOME_MESSAGE = '您好！我是 Moneki 连锁餐饮公司的数据分析助手。我可以帮您查询：\n- 营业额统计（总营业额、月度营业额、品类营业额）\n- 商品销量（热销商品、特定商品查询）\n- 门店业绩（门店排名、门店对比）\n- 支付方式分析\n- 客单价趋势\n\n请问有什么可以帮您的？';

// POST /api/ai/chat - 处理 AI 问答
router.post('/chat', async (req, res) => {
  try {
    const { question, conversationHistory = [] } = req.body;
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请输入有效的问题' });
    }
    
    const trimmedQuestion = question.trim();
    
    // 检测问候语，直接返回欢迎消息
    if (isGreeting(trimmedQuestion)) {
      return res.json({
        success: true,
        data: {
          answer: WELCOME_MESSAGE,
          sql: null,
          data: null
        }
      });
    }
    
    // 使用大模型生成 SQL（传入对话上下文）
    const aiResult = await generateSQLWithAI(trimmedQuestion, conversationHistory);
    
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
    
    // SQL安全校验
    const sqlValidation = validateSQL(aiResult.sql);
    if (!sqlValidation.valid) {
      console.error('SQL安全校验失败:', sqlValidation.error, 'SQL:', aiResult.sql);
      return res.json({
        success: true,
        data: {
          answer: '抱歉，生成的查询语句不安全，请尝试换个方式提问。',
          sql: null,
          data: null
        }
      });
    }
    
    // 执行查询
    let results;
    try {
      results = await query(aiResult.sql);
    } catch (sqlError) {
      console.error('SQL执行失败:', sqlError.message, 'SQL:', aiResult.sql);
      return res.json({
        success: true,
        data: {
          answer: '抱歉，查询执行失败，请尝试换个方式提问。',
          sql: aiResult.sql,
          desc: aiResult.description,
          data: null
        }
      });
    }
    
    // 使用大模型格式化回答
    const answer = await formatAnswerWithAI(trimmedQuestion, results, aiResult.description);
    
    console.log('AI回答:', answer);
    console.log('SQL:', aiResult.sql);
    console.log('描述:', aiResult.description);
    
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
    
    // 区分不同类型的错误
    let errorMessage = '处理问题时出错，请稍后重试';
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMessage = 'AI服务响应超时，请稍后重试';
    } else if (error.status === 429 || error.message?.includes('rate limit')) {
      errorMessage = 'AI服务请求过于频繁，请稍后重试';
    } else if (error.status === 401 || error.message?.includes('unauthorized')) {
      errorMessage = 'AI服务认证失败，请检查配置';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage
    });
  }
});

// POST /api/ai/chat/stream - 流式处理 AI 问答
router.post('/chat/stream', async (req, res) => {
  try {
    const { question, conversationHistory = [] } = req.body;
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请输入有效的问题' });
    }
    
    const trimmedQuestion = question.trim();
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    // 检测问候语，直接返回欢迎消息
    if (isGreeting(trimmedQuestion)) {
      // 流式发送欢迎消息
      const welcomeChunks = WELCOME_MESSAGE.split('\n');
      for (const chunk of welcomeChunks) {
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk + '\n' })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'done', sql: null, desc: null })}\n\n`);
      res.end();
      return;
    }
    
    // 发送思考状态
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'thinking', message: '正在分析问题...' })}\n\n`);
    
    // 使用大模型生成 SQL（传入对话上下文）
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'generating_sql', message: '正在生成查询语句...' })}\n\n`);
    const aiResult = await generateSQLWithAI(trimmedQuestion, conversationHistory);
    
    if (!aiResult.is_data_question || !aiResult.sql) {
      // 流式发送非数据问题的回答
      const descChunks = aiResult.description.split('\n');
      for (const chunk of descChunks) {
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk + '\n' })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'done', sql: null, desc: null })}\n\n`);
      res.end();
      return;
    }
    
    // SQL安全校验
    const sqlValidation = validateSQL(aiResult.sql);
    if (!sqlValidation.valid) {
      console.error('SQL安全校验失败:', sqlValidation.error, 'SQL:', aiResult.sql);
      res.write(`data: ${JSON.stringify({ type: 'content', content: '抱歉，生成的查询语句不安全，请尝试换个方式提问。' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', sql: null, desc: null })}\n\n`);
      res.end();
      return;
    }
    
    // 发送SQL和描述信息
    res.write(`data: ${JSON.stringify({ type: 'sql', sql: aiResult.sql, desc: aiResult.description })}\n\n`);
    
    // 执行查询
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'executing_query', message: '正在执行数据查询...' })}\n\n`);
    let results;
    try {
      results = await query(aiResult.sql);
      res.write(`data: ${JSON.stringify({ type: 'status', status: 'query_done', message: `查询完成，获取到 ${results.length} 条数据` })}\n\n`);
    } catch (sqlError) {
      console.error('SQL执行失败:', sqlError.message, 'SQL:', aiResult.sql);
      res.write(`data: ${JSON.stringify({ type: 'content', content: '抱歉，查询执行失败，请尝试换个方式提问。' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', sql: aiResult.sql, desc: aiResult.description })}\n\n`);
      res.end();
      return;
    }
    
    // 流式格式化回答
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'generating_answer', message: '正在生成回答...' })}\n\n`);
    await formatAnswerWithAIStream(trimmedQuestion, results, aiResult.description, res);
    
    res.end();
  } catch (error) {
    console.error('AI 流式问答处理失败：', error);
    
    // 区分不同类型的错误
    let errorMessage = '处理问题时出错，请稍后重试';
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMessage = 'AI服务响应超时，请稍后重试';
    } else if (error.status === 429 || error.message?.includes('rate limit')) {
      errorMessage = 'AI服务请求过于频繁，请稍后重试';
    } else if (error.status === 401 || error.message?.includes('unauthorized')) {
      errorMessage = 'AI服务认证失败，请检查配置';
    }
    
    // 如果响应头已发送，通过SSE发送错误
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ success: false, error: errorMessage });
    }
  }
});

module.exports = router;
