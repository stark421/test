const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../db/connection');

// 数据库 Schema 描述（用于 AI 生成 SQL）
const DB_SCHEMA = `
数据库表结构：
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
   - date: TEXT (日期, 格式 YYYY-MM-DD)
   - store_id: TEXT (外键, 关联 stores)
   - product_id: TEXT (外键, 关联 products)
   - qty: INTEGER (数量)
   - amount: REAL (金额)
   - payment: TEXT (支付方式: 现金/微信/支付宝/银行卡/会员储值)
`;

// 根据自然语言问题生成 SQL
function generateSQL(question) {
  const q = question.toLowerCase();
  
  // 哪个品类的门店营业额最高
  if (q.includes('品类') && (q.includes('最高') || q.includes('最多'))) {
    return {
      sql: `SELECT st.category, SUM(s.amount) as total_amount 
            FROM sales s 
            JOIN stores st ON s.store_id = st.store_id 
            GROUP BY st.category 
            ORDER BY total_amount DESC 
            LIMIT 1`,
      desc: '按门店品类统计营业额'
    };
  }
  
  // 特定商品销售情况
  const productMatch = q.match(/([\u4e00-\u9fa5]+poke|[\u4e00-\u9fa5]+面|[\u4e00-\u9fa5]+饭|[\u4e00-\u9fa5]+包|[\u4e00-\u9fa5]+饺|[\u4e00-\u9fa5]+三明治|[\u4e00-\u9fa5]+汤|[\u4e00-\u9fa5]+块|[\u4e00-\u9fa5]+豆|[\u4e00-\u9fa5]+茶|[\u4e00-\u9fa5]+乐|[\u4e00-\u9fa5]+酒)/);
  if (productMatch) {
    const productName = productMatch[1];
    // 检查是否有月份限制
    const monthMatch = q.match(/(\d{1,2})月/);
    let monthCondition = '';
    let params = [`%${productName}%`];
    
    if (monthMatch) {
      const month = monthMatch[1].padStart(2, '0');
      monthCondition = " AND s.date LIKE ?";
      params.push(`2026-${month}-%`);
    }
    
    return {
      sql: `SELECT p.product_name, SUM(s.qty) as total_qty, SUM(s.amount) as total_amount, COUNT(*) as order_count
            FROM sales s 
            JOIN products p ON s.product_id = p.product_id 
            WHERE p.product_name LIKE ?${monthCondition}
            GROUP BY p.product_id`,
      params: params,
      desc: `查询"${productName}"的销售情况`
    };
  }
  
  // 客单价趋势
  if (q.includes('客单价')) {
    if (q.includes('涨') || q.includes('跌') || q.includes('趋势')) {
      return {
        sql: `SELECT date, ROUND(SUM(amount)/COUNT(*), 2) as avg_amount
              FROM sales 
              GROUP BY date 
              ORDER BY date DESC 
              LIMIT 30`,
        desc: '最近30天客单价趋势'
      };
    }
  }
  
  // 各门店营业额排名
  if (q.includes('门店') && (q.includes('排名') || q.includes('对比') || q.includes('比较'))) {
    return {
      sql: `SELECT st.store_name, st.category, SUM(s.amount) as total_amount, COUNT(*) as order_count
            FROM sales s 
            JOIN stores st ON s.store_id = st.store_id 
            GROUP BY s.store_id 
            ORDER BY total_amount DESC`,
      desc: '各门店营业额排名'
    };
  }
  
  // 支付方式统计
  if (q.includes('支付') || q.includes('付款')) {
    return {
      sql: `SELECT payment, COUNT(*) as order_count, SUM(amount) as total_amount
            FROM sales 
            GROUP BY payment 
            ORDER BY total_amount DESC`,
      desc: '支付方式分布'
    };
  }
  
  // 某月营业额
  const monthQuery = q.match(/(\d{1,2})月/);
  if (monthQuery) {
    const month = monthQuery[1].padStart(2, '0');
    return {
      sql: `SELECT SUM(amount) as total_amount, COUNT(*) as order_count, ROUND(SUM(amount)/COUNT(*), 2) as avg_amount
            FROM sales 
            WHERE date LIKE ?`,
      params: [`2026-${month}-%`],
      desc: `${monthQuery[1]}月销售统计`
    };
  }
  
  // 总营业额
  if (q.includes('总') && q.includes('营业额')) {
    return {
      sql: `SELECT SUM(amount) as total_amount, COUNT(*) as order_count FROM sales`,
      desc: '总营业额统计'
    };
  }
  
  return null;
}

// 格式化查询结果为自然语言回答
function formatAnswer(question, queryResult, sqlInfo) {
  if (!queryResult || queryResult.length === 0) {
    return '抱歉，没有找到相关数据。';
  }

  const q = question.toLowerCase();
  const row = queryResult[0];
  
  // 品类最高营业额
  if (q.includes('品类') && q.includes('最高')) {
    return `根据数据分析，**${row.category}** 品类的门店营业额最高，总营业额为 ¥${Number(row.total_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}。`;
  }
  
  // 商品销售情况
  if (row.product_name) {
    const monthMatch = q.match(/(\d{1,2})月/);
    const monthStr = monthMatch ? `${monthMatch[1]}月` : '全部时间';
    return `**${row.product_name}** 在${monthStr}的销售情况：\n- 总销量：${row.total_qty} 份\n- 总营业额：¥${Number(row.total_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}\n- 订单数：${row.order_count} 笔`;
  }
  
  // 客单价趋势
  if (q.includes('客单价') && queryResult.length > 1) {
    const recent = queryResult[0];
    const earlier = queryResult[queryResult.length - 1];
    const trend = recent.avg_amount > earlier.avg_amount ? '上涨' : '下跌';
    return `根据最近30天数据，客单价整体呈**${trend}**趋势：\n- 最近一天（${recent.date}）：¥${recent.avg_amount}\n- 30天前（${earlier.date}）：¥${earlier.avg_amount}\n- 变化幅度：${((recent.avg_amount - earlier.avg_amount) / earlier.avg_amount * 100).toFixed(1)}%`;
  }
  
  // 门店排名
  if (q.includes('门店') && queryResult.length > 1) {
    let answer = '各门店营业额排名：\n';
    queryResult.forEach((store, i) => {
      answer += `${i + 1}. ${store.store_name}（${store.category}）：¥${Number(store.total_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，${store.order_count} 笔订单\n`;
    });
    return answer;
  }
  
  // 支付方式
  if (q.includes('支付') && queryResult.length > 0) {
    let answer = '支付方式分布：\n';
    queryResult.forEach(p => {
      answer += `- ${p.payment}：${p.order_count} 笔，¥${Number(p.total_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}\n`;
    });
    return answer;
  }
  
  // 月度统计
  if (row.total_amount && !row.product_name && !row.store_name) {
    return `该时段销售统计：\n- 总营业额：¥${Number(row.total_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}\n- 总订单数：${row.order_count} 笔\n- 平均客单价：¥${row.avg_amount || (row.total_amount / row.order_count).toFixed(2)}`;
  }
  
  return JSON.stringify(queryResult, null, 2);
}

// POST /api/ai/chat - 处理 AI 问答
router.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ success: false, error: '请输入问题' });
    }
    
    // 生成 SQL
    const sqlInfo = generateSQL(question);
    
    if (!sqlInfo) {
      return res.json({
        success: true,
        data: {
          answer: '抱歉，我暂时无法理解这个问题。您可以尝试问：\n- 哪个品类的门店营业额最高？\n- 牛肉poke六月卖了多少钱？\n- 客单价最近是涨了还是跌了？\n- 各门店营业额排名？',
          sql: null,
          data: null
        }
      });
    }
    
    // 执行查询
    const results = await query(sqlInfo.sql, sqlInfo.params || []);
    
    // 格式化回答
    const answer = formatAnswer(question, results, sqlInfo);
    
    res.json({
      success: true,
      data: {
        answer: answer,
        sql: sqlInfo.sql,
        desc: sqlInfo.desc,
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
