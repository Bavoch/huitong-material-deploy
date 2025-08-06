#!/bin/bash

# 会通材质管理系统 - 自动部署脚本
# 使用方法: ./deploy.sh [环境] [服务器IP]
# 示例: ./deploy.sh production 47.115.123.456

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
ENVIRONMENT=${1:-production}
SERVER_IP=${2}

if [ -z "$SERVER_IP" ]; then
    log_error "请提供服务器IP地址"
    echo "使用方法: $0 [环境] [服务器IP]"
    echo "示例: $0 production 47.115.123.456"
    exit 1
fi

# 配置变量
APP_NAME="huitong-material"
REMOTE_USER="root"
REMOTE_PATH="/opt/${APP_NAME}"
DOCKER_IMAGE="${APP_NAME}:latest"
GIT_REPO="https://github.com/Bavoch/huitong-material-deploy.git"

log_info "开始部署 ${APP_NAME} 到 ${ENVIRONMENT} 环境 (${SERVER_IP})"

# 1. 检查本地环境
log_info "检查本地环境..."
if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v ssh &> /dev/null; then
    log_error "SSH 未安装，请先安装 SSH"
    exit 1
fi

# 2. 构建 Docker 镜像
log_info "构建 Docker 镜像..."
docker build -t ${DOCKER_IMAGE} .
log_success "Docker 镜像构建完成"

# 3. 保存镜像为 tar 文件
log_info "导出 Docker 镜像..."
docker save ${DOCKER_IMAGE} | gzip > ${APP_NAME}.tar.gz
log_success "Docker 镜像导出完成"

# 4. 检查服务器连接
log_info "检查服务器连接..."
if ! ssh -o ConnectTimeout=10 ${REMOTE_USER}@${SERVER_IP} "echo 'SSH连接成功'"; then
    log_error "无法连接到服务器 ${SERVER_IP}"
    exit 1
fi
log_success "服务器连接正常"

# 5. 在服务器上创建目录
log_info "在服务器上创建应用目录..."
ssh ${REMOTE_USER}@${SERVER_IP} "mkdir -p ${REMOTE_PATH}"

# 6. 上传文件到服务器
log_info "上传文件到服务器..."
scp ${APP_NAME}.tar.gz ${REMOTE_USER}@${SERVER_IP}:${REMOTE_PATH}/
scp docker-compose.yml ${REMOTE_USER}@${SERVER_IP}:${REMOTE_PATH}/
scp nginx.conf ${REMOTE_USER}@${SERVER_IP}:${REMOTE_PATH}/
scp .env.${ENVIRONMENT} ${REMOTE_USER}@${SERVER_IP}:${REMOTE_PATH}/.env
log_success "文件上传完成"

# 7. 在服务器上部署
log_info "在服务器上执行部署..."
ssh ${REMOTE_USER}@${SERVER_IP} << EOF
    set -e
    cd ${REMOTE_PATH}
    
    # 安装 Docker 和 Docker Compose (如果未安装)
    if ! command -v docker &> /dev/null; then
        echo "安装 Docker..."
        curl -fsSL https://get.docker.com | sh
        systemctl start docker
        systemctl enable docker
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "安装 Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    
    # 停止现有服务
    echo "停止现有服务..."
    docker-compose down || true
    
    # 加载新镜像
    echo "加载 Docker 镜像..."
    docker load < ${APP_NAME}.tar.gz
    
    # 创建必要的目录
    mkdir -p backend/uploads
    mkdir -p prisma
    mkdir -p ssl
    
    # 初始化数据库
    echo "初始化数据库..."
    docker run --rm -v \$(pwd)/prisma:/app/prisma -v \$(pwd)/.env:/app/.env ${DOCKER_IMAGE} npx prisma db push || true
    
    # 启动服务
    echo "启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    echo "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    echo "检查服务状态..."
    docker-compose ps
    
    # 清理临时文件
    rm -f ${APP_NAME}.tar.gz
    
    echo "部署完成！"
EOF

log_success "服务器部署完成"

# 8. 清理本地临时文件
log_info "清理本地临时文件..."
rm -f ${APP_NAME}.tar.gz

# 9. 验证部署
log_info "验证部署状态..."
sleep 10
if curl -f http://${SERVER_IP}/health &> /dev/null; then
    log_success "应用部署成功！访问地址: http://${SERVER_IP}"
else
    log_warning "应用可能还在启动中，请稍后访问: http://${SERVER_IP}"
fi

# 10. 显示有用信息
echo ""
log_info "部署信息:"
echo "  应用名称: ${APP_NAME}"
echo "  环境: ${ENVIRONMENT}"
echo "  服务器: ${SERVER_IP}"
echo "  访问地址: http://${SERVER_IP}"
echo "  健康检查: http://${SERVER_IP}/health"
echo ""
log_info "常用命令:"
echo "  查看日志: ssh ${REMOTE_USER}@${SERVER_IP} 'cd ${REMOTE_PATH} && docker-compose logs -f'"
echo "  重启服务: ssh ${REMOTE_USER}@${SERVER_IP} 'cd ${REMOTE_PATH} && docker-compose restart'"
echo "  停止服务: ssh ${REMOTE_USER}@${SERVER_IP} 'cd ${REMOTE_PATH} && docker-compose down'"
echo "  更新应用: ./deploy.sh ${ENVIRONMENT} ${SERVER_IP}"

log_success "部署脚本执行完成！"