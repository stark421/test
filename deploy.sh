#!/bin/bash
# ============================================
# Moneki 全栈项目 - 腾讯云一键部署脚本
# 用法: chmod +x deploy.sh && ./deploy.sh
# ============================================

set -e

APP_DIR="/home/ubuntu/moneki-fullstack-assignment"
NODE_VERSION="18"

echo "=========================================="
echo "  Moneki 项目部署脚本"
echo "=========================================="

# 1. 安装 Node.js (如果没有)
if ! command -v node &> /dev/null; then
    echo "[1/6] 安装 Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[1/6] Node.js 已安装: $(node -v)"
fi

# 2. 安装 PM2 (如果没有)
if ! command -v pm2 &> /dev/null; then
    echo "[2/6] 安装 PM2..."
    sudo npm install -g pm2
else
    echo "[2/6] PM2 已安装"
fi

# 3. 安装 Nginx (如果没有)
if ! command -v nginx &> /dev/null; then
    echo "[3/6] 安装 Nginx..."
    sudo apt-get install -y nginx
else
    echo "[3/6] Nginx 已安装"
fi

# 4. 安装后端依赖
echo "[4/6] 安装后端依赖..."
cd ${APP_DIR}/backend
npm install --production

# 5. 构建前端
echo "[5/6] 构建前端..."
cd ${APP_DIR}/frontend
npm install
npm run build

# 6. 初始化数据库 & 启动服务
echo "[6/6] 启动服务..."
cd ${APP_DIR}/backend
npm run init-db

# 使用 PM2 启动（如果已有进程则重启）
pm2 delete moneki-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# 配置 Nginx
echo "配置 Nginx..."
sudo cp ${APP_DIR}/nginx.conf /etc/nginx/sites-available/moneki
sudo ln -sf /etc/nginx/sites-available/moneki /etc/nginx/sites-enabled/moneki
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "=========================================="
echo "  部署完成!"
echo "  访问: http://$(curl -s ifconfig.me)"
echo "  后端端口: 3002"
echo "  PM2 状态: pm2 status"
echo "  查看日志: pm2 logs moneki-backend"
echo "=========================================="
