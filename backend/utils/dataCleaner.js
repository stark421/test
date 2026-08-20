const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * 数据清洗工具
 * 处理脏数据：日期格式、空格、无效外键、空值、重复订单
 */

// 标准化日期格式为 YYYY-MM-DD
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  // 去除首尾空格
  dateStr = dateStr.trim();
  
  // 处理 2026/05/21 格式
  if (dateStr.includes('/')) {
    return dateStr.replace(/\//g, '-');
  }
  
  // 处理 DD-MM-YYYY 格式（如 15-07-2026）
  const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const ddmmyyyyMatch = dateStr.match(ddmmyyyyPattern);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    // 验证日期合理性
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // 已经是 YYYY-MM-DD 格式
  return dateStr;
}

// 去除字符串首尾空格
function trimStr(str) {
  return str ? str.trim() : str;
}

// 读取并解析 CSV 文件
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// 清洗 sales 数据
async function cleanSalesData(dataDir) {
  const salesPath = path.join(dataDir, 'sales.csv');
  const productsPath = path.join(dataDir, 'products.csv');
  
  const [rawSales, products] = await Promise.all([
    readCSV(salesPath),
    readCSV(productsPath)
  ]);

  // 建立商品价格映射
  const productPriceMap = {};
  products.forEach(p => {
    productPriceMap[trimStr(p.product_id)] = parseFloat(p.unit_price);
  });

  // 已知有效门店和商品
  const validStoreIds = new Set(['S01', 'S02', 'S03', 'S04', 'S05']);
  const validProductIds = new Set(Object.keys(productPriceMap));

  const seenOrderIds = new Set();
  const cleanedSales = [];
  let dirtyCount = 0;

  rawSales.forEach(row => {
    const storeId = trimStr(row.store_id);
    const productId = trimStr(row.product_id);
    const orderId = trimStr(row.order_id);

    // 跳过无效外键
    if (!validStoreIds.has(storeId) || !validProductIds.has(productId)) {
      dirtyCount++;
      return;
    }

    // 跳过重复订单
    if (seenOrderIds.has(orderId)) {
      dirtyCount++;
      return;
    }
    seenOrderIds.add(orderId);

    // 标准化日期
    const date = normalizeDate(row.date);
    if (!date) {
      dirtyCount++;
      return;
    }

    // 处理空 amount：用 qty * unit_price 计算
    let amount = parseFloat(row.amount);
    const qty = parseInt(row.qty);
    
    if (isNaN(amount) || amount === 0) {
      const unitPrice = productPriceMap[productId];
      amount = qty * unitPrice;
    }

    cleanedSales.push({
      order_id: orderId,
      date: date,
      store_id: storeId,
      product_id: productId,
      qty: qty,
      amount: amount,
      payment: trimStr(row.payment)
    });
  });

  console.log(`Sales 数据清洗完成：原始 ${rawSales.length} 条，清洗后 ${cleanedSales.length} 条，剔除 ${dirtyCount} 条`);
  return cleanedSales;
}

// 读取门店数据
async function readStores(dataDir) {
  const storesPath = path.join(dataDir, 'stores.csv');
  const stores = await readCSV(storesPath);
  return stores.map(s => ({
    store_id: trimStr(s.store_id),
    store_name: trimStr(s.store_name),
    category: trimStr(s.category),
    district: trimStr(s.district)
  }));
}

// 读取商品数据
async function readProducts(dataDir) {
  const productsPath = path.join(dataDir, 'products.csv');
  const products = await readCSV(productsPath);
  return products.map(p => ({
    product_id: trimStr(p.product_id),
    product_name: trimStr(p.product_name),
    product_category: trimStr(p.product_category),
    unit_price: parseFloat(p.unit_price)
  }));
}

module.exports = {
  cleanSalesData,
  readStores,
  readProducts
};
