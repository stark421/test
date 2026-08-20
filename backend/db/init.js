const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');
const { cleanSalesData, readStores, readProducts } = require('../utils/dataCleaner');

const DB_PATH = path.join(__dirname, 'moneki.db');
const DATA_DIR = path.join(__dirname, '../../data');

// 创建数据库表
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS stores (
    store_id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    category TEXT NOT NULL,
    district TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_category TEXT NOT NULL,
    unit_price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    order_id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    store_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment TEXT NOT NULL,
    FOREIGN KEY (store_id) REFERENCES stores(store_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
  CREATE INDEX IF NOT EXISTS idx_sales_store ON sales(store_id);
  CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);
`;

async function initDatabase() {
  console.log('正在初始化数据库...');
  
  const SQL = await initSQL();
  
  // 如果数据库文件存在则删除重建
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('已删除旧数据库');
  }

  const db = new SQL.Database();
  
  // 创建表
  db.run(CREATE_TABLES_SQL);
  console.log('数据库表创建完成');

  // 读取并清洗数据
  const [stores, products, sales] = await Promise.all([
    readStores(DATA_DIR),
    readProducts(DATA_DIR),
    cleanSalesData(DATA_DIR)
  ]);

  // 插入门店数据
  const insertStore = db.prepare('INSERT INTO stores (store_id, store_name, category, district) VALUES (?, ?, ?, ?)');
  stores.forEach(s => {
    insertStore.run([s.store_id, s.store_name, s.category, s.district]);
  });
  insertStore.free();
  console.log(`门店数据导入完成：${stores.length} 条`);

  // 插入商品数据
  const insertProduct = db.prepare('INSERT INTO products (product_id, product_name, product_category, unit_price) VALUES (?, ?, ?, ?)');
  products.forEach(p => {
    insertProduct.run([p.product_id, p.product_name, p.product_category, p.unit_price]);
  });
  insertProduct.free();
  console.log(`商品数据导入完成：${products.length} 条`);

  // 插入销售数据
  const insertSale = db.prepare('INSERT INTO sales (order_id, date, store_id, product_id, qty, amount, payment) VALUES (?, ?, ?, ?, ?, ?, ?)');
  sales.forEach(s => {
    insertSale.run([s.order_id, s.date, s.store_id, s.product_id, s.qty, s.amount, s.payment]);
  });
  insertSale.free();
  console.log(`销售数据导入完成：${sales.length} 条`);

  // 保存数据库文件
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  console.log(`数据库已保存到：${DB_PATH}`);

  db.close();
  return DB_PATH;
}

// 如果直接运行此文件则执行初始化
if (require.main === module) {
  initDatabase()
    .then(() => console.log('数据库初始化成功！'))
    .catch(err => console.error('数据库初始化失败：', err));
}

module.exports = { initDatabase, DB_PATH };
