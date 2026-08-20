const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');
const { DB_PATH, initDatabase } = require('./init');

let db = null;
let initPromise = null;

// 获取数据库连接（单例，支持内存模式）
async function getDb() {
  if (db) return db;

  // Vercel 环境：纯内存模式
  if (process.env.VERCEL) {
    if (!initPromise) {
      initPromise = initDatabase({ inMemory: true }).then(inMemoryDb => {
        db = inMemoryDb;
        return db;
      });
    }
    return initPromise;
  }

  // 本地环境：文件模式
  if (!fs.existsSync(DB_PATH)) {
    throw new Error('数据库文件不存在，请先运行 init.js 初始化数据库');
  }

  const SQL = await initSQL();
  const fileBuffer = fs.readFileSync(DB_PATH);
  db = new SQL.Database(fileBuffer);
  return db;
}

// 执行查询并返回结果
async function query(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// 获取单个值
async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

module.exports = { getDb, query, queryOne };
