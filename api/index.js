// Vercel Serverless Function 入口
// 使用 handler 模式而非直接导出 Express app，确保所有错误都能被捕获并返回 CORS 头

let app;
let loadError;

try {
  app = require('../backend/server');
} catch (error) {
  console.error('Server module load failed:', error);
  loadError = error;
}

module.exports = async (req, res) => {
  // 手动设置 CORS 头，确保即使出错也有
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (loadError) {
    return res.status(500).json({
      success: false,
      error: 'Server init failed: ' + loadError.message
    });
  }

  try {
    app(req, res);
  } catch (error) {
    console.error('Request handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};
