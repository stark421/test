require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/init');
const statsRoutes = require('./routes/stats');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务（仅本地开发时使用，Vercel 由 CDN 处理）
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
}

// API 路由
app.use('/api/stats', statsRoutes);
app.use('/api/ai', aiRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 前端路由回退（仅本地开发时使用）
if (!process.env.VERCEL) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// 启动服务器（本地开发）
async function start() {
  try {
    // 初始化数据库
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`API 地址: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('启动失败：', error);
    process.exit(1);
  }
}

// 本地开发时直接启动
if (!process.env.VERCEL) {
  start();
}

// 导出 app 供 Vercel 使用
module.exports = app;

// 全局错误处理（放在最后）
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});
