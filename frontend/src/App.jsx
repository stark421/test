import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { getDailyStats, getSummaryStats, getTop10Products, getPaymentStats, getStoreStats } from './api';
import Dashboard from './components/Dashboard';
import ChatBox from './components/ChatBox';

const DEFAULT_START_DATE = '2026-05-01';
const DEFAULT_END_DATE = '2026-07-31';

function App() {
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [dailyData, setDailyData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [storeData, setStoreData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteredSummaryData, setFilteredSummaryData] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // 获取数据（使用默认日期范围）
  const fetchData = async (start = DEFAULT_START_DATE, end = DEFAULT_END_DATE) => {
    setLoading(true);
    setError(null);
    
    try {
      const [summaryRes, dailyRes, topRes, paymentRes, storeRes] = await Promise.all([
        getSummaryStats(start, end),
        getDailyStats(start, end),
        getTop10Products(start, end),
        getPaymentStats(start, end),
        getStoreStats(start, end)
      ]);

      if (summaryRes.success) setSummaryData(summaryRes.data);
      if (dailyRes.success) setDailyData(dailyRes.data);
      if (topRes.success) setTopProducts(topRes.data);
      if (paymentRes.success) setPaymentData(paymentRes.data);
      if (storeRes.success) setStoreData(storeRes.data);
    } catch (err) {
      console.error('获取数据失败：', err);
      setError('获取数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = async () => {
    setHasSearched(true);
    setLoading(true);
    setError(null);
    
    try {
      const [summaryRes, dailyRes, topRes, paymentRes, storeRes] = await Promise.all([
        getSummaryStats(startDate, endDate),
        getDailyStats(startDate, endDate),
        getTop10Products(startDate, endDate),
        getPaymentStats(startDate, endDate),
        getStoreStats(startDate, endDate)
      ]);

      if (summaryRes.success) setFilteredSummaryData(summaryRes.data);
      if (dailyRes.success) setDailyData(dailyRes.data);
      if (topRes.success) setTopProducts(topRes.data);
      if (paymentRes.success) setPaymentData(paymentRes.data);
      if (storeRes.success) setStoreData(storeRes.data);
    } catch (err) {
      console.error('获取数据失败：', err);
      setError('获取数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilter = () => {
    setStartDate(DEFAULT_START_DATE);
    setEndDate(DEFAULT_END_DATE);
    setFilteredSummaryData(null);
    setHasSearched(false);
    fetchData();
  };

  const formatCurrency = (value) => {
    return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  };

  const formatNumber = (value) => {
    return Number(value).toLocaleString('zh-CN');
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Moneki 数据看板</h1>
        <p>连锁餐饮经营数据可视化</p>
      </div>

      <div className="dashboard">
        {error && <div className="error">{error}</div>}

        {summaryData && (
          <div className="stats-cards">
            <div className="stat-card">
              <h3>总营业额</h3>
              <div className="value primary">{formatCurrency(summaryData.totalAmount)}</div>
            </div>
            <div className="stat-card">
              <h3>总订单数</h3>
              <div className="value">{formatNumber(summaryData.totalOrders)}</div>
            </div>
            <div className="stat-card">
              <h3>平均客单价</h3>
              <div className="value success">{formatCurrency(summaryData.avgOrderAmount)}</div>
            </div>
            <div className="stat-card">
              <h3>总销量</h3>
              <div className="value">{formatNumber(summaryData.totalQty)}</div>
            </div>
          </div>
        )}

        <div className="filters">
          <label>日期范围：</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span>至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <button onClick={handleSearch}>查询</button>
          <button onClick={handleClearFilter} className="clear-btn">清空筛选</button>
        </div>

        {hasSearched && filteredSummaryData && (
          <div className="stats-cards">
            <div className="stat-card">
              <h3>筛选后总营业额</h3>
              <div className="value primary">{formatCurrency(filteredSummaryData.totalAmount)}</div>
            </div>
            <div className="stat-card">
              <h3>筛选后总订单数</h3>
              <div className="value">{formatNumber(filteredSummaryData.totalOrders)}</div>
            </div>
            <div className="stat-card">
              <h3>筛选后平均客单价</h3>
              <div className="value success">{formatCurrency(filteredSummaryData.avgOrderAmount)}</div>
            </div>
            <div className="stat-card">
              <h3>筛选后总销量</h3>
              <div className="value">{formatNumber(filteredSummaryData.totalQty)}</div>
            </div>
          </div>
        )}

        <Dashboard
          dailyData={dailyData}
          topProducts={topProducts}
          paymentData={paymentData}
          storeData={storeData}
          loading={loading}
          formatCurrency={formatCurrency}
          formatNumber={formatNumber}
        />

        <div className="chat-section">
          <ChatBox />
        </div>
      </div>
    </div>
  );
}

export default App;
