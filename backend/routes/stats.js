const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../db/connection');

// GET /api/stats/daily - 按日期区间返回每日营业额、订单数、客单价
router.get('/daily', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let sql = `
      SELECT 
        date,
        COUNT(*) as order_count,
        SUM(amount) as total_amount,
        ROUND(SUM(amount) / COUNT(*), 2) as avg_order_amount
      FROM sales
    `;
    
    const params = [];
    const conditions = [];
    
    if (start) {
      conditions.push('date >= ?');
      params.push(start);
    }
    if (end) {
      conditions.push('date <= ?');
      params.push(end);
    }
    if (req.query.stores) {
      const storeIds = req.query.stores.split(',').filter(Boolean);
      if (storeIds.length > 0) {
        conditions.push(`store_id IN (${storeIds.map(() => '?').join(',')})`);
        params.push(...storeIds);
      }
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' GROUP BY date ORDER BY date';
    
    const results = await query(sql, params);
    
    res.json({
      success: true,
      data: results.map(r => ({
        date: r.date,
        orderCount: r.order_count,
        totalAmount: r.total_amount,
        avgOrderAmount: r.avg_order_amount
      }))
    });
  } catch (error) {
    console.error('获取每日统计失败：', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// GET /api/stats/summary - 获取汇总统计
router.get('/summary', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let sql = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(amount) as total_amount,
        ROUND(SUM(amount) / COUNT(*), 2) as avg_order_amount,
        SUM(qty) as total_qty
      FROM sales
    `;
    
    const params = [];
    const conditions = [];
    
    if (start) {
      conditions.push('date >= ?');
      params.push(start);
    }
    if (end) {
      conditions.push('date <= ?');
      params.push(end);
    }
    if (req.query.stores) {
      const storeIds = req.query.stores.split(',').filter(Boolean);
      if (storeIds.length > 0) {
        conditions.push(`store_id IN (${storeIds.map(() => '?').join(',')})`);
        params.push(...storeIds);
      }
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    const result = await queryOne(sql, params);
    
    res.json({
      success: true,
      data: {
        totalOrders: result.total_orders,
        totalAmount: result.total_amount,
        avgOrderAmount: result.avg_order_amount,
        totalQty: result.total_qty
      }
    });
  } catch (error) {
    console.error('获取汇总统计失败：', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// GET /api/stats/stores - 各门店统计
router.get('/stores', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let sql = `
      SELECT 
        s.store_id,
        st.store_name,
        st.category,
        st.district,
        COUNT(*) as order_count,
        SUM(s.amount) as total_amount,
        ROUND(SUM(s.amount) / COUNT(*), 2) as avg_order_amount
      FROM sales s
      JOIN stores st ON s.store_id = st.store_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (start) {
      conditions.push('s.date >= ?');
      params.push(start);
    }
    if (end) {
      conditions.push('s.date <= ?');
      params.push(end);
    }
    if (req.query.stores) {
      const storeIds = req.query.stores.split(',').filter(Boolean);
      if (storeIds.length > 0) {
        conditions.push(`s.store_id IN (${storeIds.map(() => '?').join(',')})`);
        params.push(...storeIds);
      }
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' GROUP BY s.store_id ORDER BY total_amount DESC';
    
    const results = await query(sql, params);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取门店统计失败：', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// GET /api/products/top10 - 全部商品统计
router.get('/products/top10', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let sql = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_category,
        p.unit_price,
        SUM(s.qty) as total_qty,
        SUM(s.amount) as total_amount,
        COUNT(*) as order_count
      FROM sales s
      JOIN products p ON s.product_id = p.product_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (start) {
      conditions.push('s.date >= ?');
      params.push(start);
    }
    if (end) {
      conditions.push('s.date <= ?');
      params.push(end);
    }
    if (req.query.stores) {
      const storeIds = req.query.stores.split(',').filter(Boolean);
      if (storeIds.length > 0) {
        conditions.push(`s.store_id IN (${storeIds.map(() => '?').join(',')})`);
        params.push(...storeIds);
      }
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' GROUP BY p.product_id ORDER BY total_amount DESC';
    
    const results = await query(sql, params);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取商品统计失败：', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// GET /api/stores - 获取门店列表
router.get('/stores/list', async (req, res) => {
  try {
    const results = await query('SELECT * FROM stores ORDER BY store_id');
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('获取门店列表失败：', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// GET /api/products - 获取商品列表
router.get('/products/list', async (req, res) => {
  try {
    const results = await query('SELECT * FROM products ORDER BY product_id');
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('获取商品列表失败：', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// GET /api/stats/payment - 支付方式统计
router.get('/payment', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let sql = `
      SELECT 
        payment,
        COUNT(*) as order_count,
        SUM(amount) as total_amount
      FROM sales
    `;
    
    const params = [];
    const conditions = [];
    
    if (start) {
      conditions.push('date >= ?');
      params.push(start);
    }
    if (end) {
      conditions.push('date <= ?');
      params.push(end);
    }
    if (req.query.stores) {
      const storeIds = req.query.stores.split(',').filter(Boolean);
      if (storeIds.length > 0) {
        conditions.push(`store_id IN (${storeIds.map(() => '?').join(',')})`);
        params.push(...storeIds);
      }
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' GROUP BY payment ORDER BY total_amount DESC';
    
    const results = await query(sql, params);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取支付方式统计失败：', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

module.exports = router;
