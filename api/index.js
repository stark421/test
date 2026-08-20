// Vercel Serverless Function 入口
let app;
let loadError;

try {
  app = require('../backend/server');
} catch (error) {
  console.error('Server load error:', error);
  loadError = error;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (loadError) {
    return res.status(500).json({
      success: false,
      error: 'Server load failed: ' + loadError.message
    });
  }

  try {
    app(req, res);
  } catch (error) {
    console.error('Request error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
