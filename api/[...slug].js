// Vercel Serverless Function entry point
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

  // Debug info endpoint
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/debug-info') {
    return res.status(200).json({
      loadError: loadError ? loadError.message : null,
      loadStack: loadError ? loadError.stack : null,
      appType: typeof app,
      isFunction: typeof app === 'function',
      url: req.url,
      pathname: url.pathname,
    });
  }

  if (loadError) {
    return res.status(500).json({
      success: false,
      error: 'Server load failed: ' + loadError.message,
    });
  }

  // Ensure req.url has /api prefix for Express routing
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
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
