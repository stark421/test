// Vercel Serverless Function 入口
let app;
try {
  app = require('../backend/server');
} catch (error) {
  console.error('Server module load failed:', error);
  // 返回一个最小化的 Express app，输出错误信息
  const express = require('express');
  app = express();
  app.all('*', (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  });
}

module.exports = app;
