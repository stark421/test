import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#a0d911'];

function PieChartSVG({ data, nameKey, valueKey, title, formatValue, size = 'normal' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const getArcPath = (cx, cy, r, startAngle, endAngle) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  const total = data.reduce((sum, item) => sum + item[valueKey], 0);

  const slices = useMemo(() => {
    let currentAngle = 0;
    return data.map((item, index) => {
      const angle = (item[valueKey] / total) * 360;
      const slice = {
        ...item,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        color: COLORS[index % COLORS.length],
      };
      currentAngle += angle;
      return slice;
    });
  }, [data, total, valueKey]);

  const viewBox = size === 'large' ? '0 0 400 400' : '0 0 300 300';
  const cx = size === 'large' ? 200 : 150;
  const cy = size === 'large' ? 200 : 150;
  const baseR = size === 'large' ? 140 : 100;
  const hoverR = size === 'large' ? 155 : 110;
  const textY1 = size === 'large' ? 370 : 280;
  const textY2 = size === 'large' ? 395 : 300;
  const svgClass = size === 'large' ? 'pie-svg pie-svg-large' : 'pie-svg';

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="pie-chart-container">
        <svg viewBox={viewBox} className={svgClass}>
          {slices.map((slice, i) => {
            const r = hoveredIndex === i ? hoverR : baseR;
            const path = getArcPath(cx, cy, r, slice.startAngle, slice.endAngle);
            return (
              <path
                key={slice[nameKey]}
                d={path}
                fill={slice.color}
                stroke="#fff"
                strokeWidth="2"
                style={{ transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', transformOrigin: `${cx}px ${cy}px` }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
          {hoveredIndex !== null && (
            <>
              <text x={cx} y={textY1} textAnchor="middle" fill="#333" fontSize="14" fontWeight="bold">
                {slices[hoveredIndex][nameKey]}
              </text>
              <text x={cx} y={textY2} textAnchor="middle" fill="#666" fontSize="12">
                {formatValue ? formatValue(slices[hoveredIndex][valueKey], slices[hoveredIndex]) : slices[hoveredIndex][valueKey]}
                {' '}({((slices[hoveredIndex][valueKey] / total) * 100).toFixed(1)}%)
              </text>
            </>
          )}
        </svg>
        <div className="pie-legend">
          {slices.map((slice, i) => (
            <div
              key={slice[nameKey]}
              className={`legend-item ${hoveredIndex === i ? 'legend-item-active' : ''}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span className="legend-color" style={{ background: slice.color }}></span>
              <span className="legend-label">{slice[nameKey]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ dailyData, summaryData, topProducts, paymentData, storeData, loading, formatCurrency, formatNumber }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'desc') return { key, direction: 'asc' };
        if (prev.direction === 'asc') return { key: null, direction: null };
      }
      return { key, direction: 'desc' };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return ' ↕';
    return sortConfig.direction === 'desc' ? ' ↓' : ' ↑';
  };

  const sortedProducts = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return topProducts;
    const sorted = [...topProducts].sort((a, b) => {
      const diff = a[sortConfig.key] - b[sortConfig.key];
      return sortConfig.direction === 'desc' ? -diff : diff;
    });
    return sorted;
  }, [topProducts, sortConfig]);

  const categoryData = useMemo(() => {
    const map = {};
    topProducts.forEach((p) => {
      if (!map[p.product_category]) {
        map[p.product_category] = { category: p.product_category, total_amount: 0 };
      }
      map[p.product_category].total_amount += p.total_amount;
    });
    return Object.values(map).sort((a, b) => b.total_amount - a.total_amount);
  }, [topProducts]);

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

      {/* 扇形图区域 */}
      <div className="pie-layout">
        <div className="pie-left">
          {topProducts && topProducts.length > 0 && (
            <PieChartSVG
              data={topProducts}
              nameKey="product_name"
              valueKey="total_amount"
              title="商品销售额分布"
              formatValue={(val) => formatCurrency(val)}
              size="large"
            />
          )}
        </div>

        <div className="pie-right">
          {paymentData && paymentData.length > 0 && (
            <PieChartSVG
              data={paymentData}
              nameKey="payment"
              valueKey="order_count"
              title="支付方式分布"
              formatValue={(val) => `${val} 单`}
            />
          )}

          {storeData && storeData.length > 0 && (
            <PieChartSVG
              data={storeData}
              nameKey="store_name"
              valueKey="total_amount"
              title="门店营业额分布"
              formatValue={(val) => formatCurrency(val)}
            />
          )}

          {categoryData && categoryData.length > 0 && (
            <PieChartSVG
              data={categoryData}
              nameKey="category"
              valueKey="total_amount"
              title="商品品类营业额分布"
              formatValue={(val) => formatCurrency(val)}
            />
          )}
        </div>
      </div>

      {/* 全部商品表格 */}
      <div className="table-card">
        <h3>商品销售详情</h3>
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>商品名称</th>
              <th>品类</th>
              <th className="sortable" onClick={() => handleSort('unit_price')}>单价{getSortIndicator('unit_price')}</th>
              <th className="sortable" onClick={() => handleSort('total_qty')}>销量{getSortIndicator('total_qty')}</th>
              <th className="sortable" onClick={() => handleSort('total_amount')}>营业额{getSortIndicator('total_amount')}</th>
              <th className="sortable" onClick={() => handleSort('order_count')}>订单数{getSortIndicator('order_count')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((product, index) => (
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
