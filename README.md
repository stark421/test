# Moneki 全栈开发作业

连锁餐饮公司数据看板与 AI 问答系统

## 快速启动（3步）

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 初始化数据库

```bash
cd backend
npm run init-db
```

### 3. 启动服务

```bash
cd backend
npm start
```

访问 http://localhost:3002 即可查看数据看板。

---

## 项目架构

```
moneki-fullstack-assignment/
├── backend/                    # 后端服务
│   ├── server.js              # Express 主入口
│   ├── db/
│   │   ├── init.js            # 数据库初始化脚本
│   │   ├── connection.js      # 数据库连接工具
│   │   └── moneki.db          # SQLite 数据库文件
│   ├── routes/
│   │   ├── stats.js           # 统计数据 API
│   │   └── ai.js              # AI 问答 API
│   └── utils/
│       └── dataCleaner.js     # 数据清洗工具
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── App.jsx            # 主应用组件
│   │   ├── components/
│   │   │   ├── Dashboard.jsx  # 数据看板组件
│   │   │   └── ChatBox.jsx    # AI 对话组件
│   │   └── api/
│   │       └── index.js       # API 调用封装
│   └── package.json
├── data/                       # 原始数据
│   ├── sales.csv
│   ├── stores.csv
│   └── products.csv
└── README.md
```

---

## 技术选型

| 层级 | 技术 | 选择理由 |
|------|------|----------|
| 后端框架 | Express.js | 轻量、生态丰富、学习成本低 |
| 数据库 | SQLite (sql.js) | 零配置、单文件部署、满足数据量需求 |
| 前端框架 | React 18 | 组件化开发、社区活跃 |
| 构建工具 | Vite | 快速热更新、开箱即用 |
| 图表库 | Recharts | React 生态、声明式 API |
| HTTP 客户端 | Axios | 拦截器支持、Promise API |

---

## 数据清洗策略

原始数据存在以下脏数据问题，已在 `backend/utils/dataCleaner.js` 中处理：

| 问题 | 数量 | 处理方式 |
|------|------|----------|
| 日期格式不一致 | 2种格式 | 统一转换为 YYYY-MM-DD |
| store_id 尾随空格 | 4条 | trim 处理 |
| 无效外键 (S99) | 7条 | 剔除 |
| 无效外键 (P99) | 30条 | 剔除 |
| 空 amount 字段 | 120条 | 根据 qty × unit_price 计算填充 |
| 重复 order_id | 80组 | 保留首条，剔除重复 |

**清洗结果**：原始 12,131 条 → 清洗后 12,006 条（剔除 125 条）

---

## API 文档

### 统计接口

| 接口 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/stats/daily` | GET | start, end | 每日营业额、订单数、客单价 |
| `/api/stats/summary` | GET | start, end | 汇总统计 |
| `/api/stats/stores` | GET | start, end | 各门店统计 |
| `/api/stats/products/top10` | GET | start, end | Top10 商品 |
| `/api/stats/payment` | GET | start, end | 支付方式统计 |

### AI 问答接口

| 接口 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/ai/chat` | POST | { question } | 自然语言数据问答 |

**示例问题**：
- 哪个品类的门店营业额最高？
- 牛肉poke六月卖了多少钱？
- 客单价最近是涨了还是跌了？
- 各门店营业额排名？

---

## AI 问答实现说明

本项目采用**基于规则的 Text-to-SQL** 方案，而非调用大模型 API：

1. 用户输入自然语言问题
2. 通过关键词匹配和正则表达式识别意图
3. 动态生成 SQL 查询语句
4. 执行查询并格式化为自然语言回答

**选择理由**：
- 保证回答 100% 基于真实数据，不会出现 AI 幻觉
- 响应速度快（毫秒级）
- 无需 API Key，零成本运行
- 便于验证数据准确性

**支持的问题类型**：
- 品类/门店营业额排名
- 特定商品销售查询（支持月份筛选）
- 客单价趋势分析
- 支付方式统计
- 月度/总营业额查询

---

## 开发环境

- Node.js >= 18
- npm >= 9

---

## 许可证

MIT
