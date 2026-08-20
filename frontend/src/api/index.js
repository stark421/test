import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000
});

// 获取每日统计
export const getDailyStats = async (start, end, stores) => {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;
  if (stores && stores.length > 0) params.stores = stores.join(',');
  const { data } = await api.get('/stats/daily', { params });
  return data;
};

// 获取汇总统计
export const getSummaryStats = async (start, end, stores) => {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;
  if (stores && stores.length > 0) params.stores = stores.join(',');
  const { data } = await api.get('/stats/summary', { params });
  return data;
};

// 获取门店统计
export const getStoreStats = async (start, end, stores) => {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;
  if (stores && stores.length > 0) params.stores = stores.join(',');
  const { data } = await api.get('/stats/stores', { params });
  return data;
};

// 获取 Top10 商品
export const getTop10Products = async (start, end, stores) => {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;
  if (stores && stores.length > 0) params.stores = stores.join(',');
  const { data } = await api.get('/stats/products/top10', { params });
  return data;
};

// 获取支付方式统计
export const getPaymentStats = async (start, end, stores) => {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;
  if (stores && stores.length > 0) params.stores = stores.join(',');
  const { data } = await api.get('/stats/payment', { params });
  return data;
};

// 获取门店列表
export const getStores = async () => {
  const { data } = await api.get('/stats/stores/list');
  return data;
};

// 获取商品列表
export const getProducts = async () => {
  const { data } = await api.get('/stats/products/list');
  return data;
};

export default api;
