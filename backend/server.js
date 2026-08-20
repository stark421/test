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

// 静态文件服务（前端构建产物）
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API 路由
app.use('/api/stats', statsRoutes);
app.use('/api/ai', aiRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 前端路由回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 启动服务器
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

start();
