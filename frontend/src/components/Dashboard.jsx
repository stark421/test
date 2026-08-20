import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function Dashboard({ dailyData, summaryData, topProducts, loading, formatCurrency, formatNumber }) {
  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <>
      {/* 汇总统计卡片 */}
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

      {/* 图表区域 */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>营业额趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value) => [formatCurrency(value), '营业额']}
                labelFormatter={(label) => `日期：${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="totalAmount" 
                stroke="#1890ff" 
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>订单数趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value) => [formatNumber(value), '订单数']}
                labelFormatter={(label) => `日期：${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="orderCount" 
                stroke="#52c41a" 
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top10 商品表格 */}
      <div className="table-card">
        <h3>Top 10 商品（按营业额）</h3>
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>商品名称</th>
              <th>品类</th>
              <th>单价</th>
              <th>销量</th>
              <th>营业额</th>
              <th>订单数</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((product, index) => (
              <tr key={product.product_id}>
                <td>
                  <span className={`rank ${index < 3 ? 'top3' : ''}`}>
                    {index + 1}
                  </span>
                </td>
                <td>{product.product_name}</td>
                <td>{product.product_category}</td>
                <td>{formatCurrency(product.unit_price)}</td>
                <td>{formatNumber(product.total_qty)}</td>
                <td>{formatCurrency(product.total_amount)}</td>
                <td>{formatNumber(product.order_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default Dashboard;
