#!/bin/bash

# 会通材质管理系统部署脚本
# 适用于阿里云ECS服务器

set -e

echo "🚀 开始部署会通材质管理系统..."

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用root权限运行此脚本"
    exit 1
fi

# 更新系统
echo "📦 更新系统包..."
yum update -y

# 安装Docker
echo "🐳 安装Docker..."
yum install -y docker
systemctl start docker
systemctl enable docker

# 安装Docker Compose
echo "🔧 安装Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 安装Git
echo "📥 安装Git..."
yum install -y git

# 创建应用目录
APP_DIR="/opt/huitong-material"
echo "📁 创建应用目录: $APP_DIR"
mkdir -p $APP_DIR
cd $APP_DIR

# 克隆代码仓库
echo "📥 克隆代码仓库..."
if [ -d ".git" ]; then
    git pull origin main
else
    git clone https://github.com/Bavoch/huitong-material-deploy.git .
fi

# 复制环境配置文件
echo "⚙️ 配置环境变量..."
if [ ! -f ".env" ]; then
    cp .env.production .env
    echo "⚠️ 请编辑 .env 文件配置数据库连接信息"
    echo "⚠️ 文件位置: $APP_DIR/.env"
fi

# 创建SSL证书目录
echo "🔐 创建SSL证书目录..."
mkdir -p ssl
if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
    echo "⚠️ 请将SSL证书文件放置到 $APP_DIR/ssl/ 目录下"
    echo "⚠️ 需要文件: cert.pem 和 key.pem"
    echo "⚠️ 如果没有SSL证书，可以使用Let's Encrypt获取免费证书"
fi

# 创建上传目录
echo "📁 创建上传目录..."
mkdir -p backend/uploads
chmod 755 backend/uploads

# 构建并启动服务
echo "🏗️ 构建并启动服务..."
docker-compose down
docker-compose build
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
docker-compose exec app npx prisma db push

echo "✅ 部署完成！"
echo ""
echo "📋 部署信息:"
echo "   - 应用目录: $APP_DIR"
echo "   - HTTP端口: 80"
echo "   - HTTPS端口: 443"
echo "   - 数据库端口: 5432"
echo ""
echo "🔧 后续配置:"
echo "   1. 编辑 $APP_DIR/.env 文件配置数据库连接"
echo "   2. 将SSL证书放置到 $APP_DIR/ssl/ 目录"
echo "   3. 配置域名解析指向服务器IP"
echo "   4. 重启服务: cd $APP_DIR && docker-compose restart"
echo ""
echo "📊 查看日志: cd $APP_DIR && docker-compose logs -f"
echo "🔄 重启服务: cd $APP_DIR && docker-compose restart"
echo "🛑 停止服务: cd $APP_DIR && docker-compose down"