// Vercel Serverless Function 入口
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 解析 URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 健康检查（不加载后端）
  if (pathname === '/api/health') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // 尝试加载后端
  let app;
  try {
    app = require('../backend/server');
  } catch (error) {
    console.error('Server load error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server load failed: ' + error.message,
      stack: error.stack
    });
  }

  // 尝试处理请求
  try {
    app(req, res);
  } catch (error) {
    console.error('Request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Request failed: ' + error.message,
        stack: error.stack
      });
    }
  }
};
