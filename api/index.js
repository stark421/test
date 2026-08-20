// Vercel Serverless Function 入口
// 将 Express app 导出为 Vercel 可识别的 handler
const app = require('../backend/server');

module.exports = app;
