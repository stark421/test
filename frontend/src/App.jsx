import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { getDailyStats, getSummaryStats, getTop10Products } from './api';
import Dashboard from './components/Dashboard';
import ChatBox from './components/ChatBox';

function App() {
  const [startDate, setStartDate] = useState('2026-05-01');
  const [endDate, setEndDate] = useState('2026-07-31');
  const [dailyData, setDailyData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [dailyRes, summaryRes, topRes] = await Promise.all([
        getDailyStats(startDate, endDate),
        getSummaryStats(startDate, endDate),
        getTop10Products(startDate, endDate)
      ]);

      if (dailyRes.success) setDailyData(dailyRes.data);
      if (summaryRes.success) setSummaryData(summaryRes.data);
      if (topRes.success) setTopProducts(topRes.data);
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

  const handleSearch = () => {
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
        </div>

        {error && <div className="error">{error}</div>}

        <Dashboard
          dailyData={dailyData}
          summaryData={summaryData}
          topProducts={topProducts}
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
