# 🎨 会通材质管理系统

一个现代化的 3D 材质管理和预览系统，支持材质上传、预览、管理和自动化部署。

## 🚀 快速开始

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/Bavoch/huitong-material-deploy.git
cd huitong-material-deploy

# 2. 安装依赖
npm install

# 3. 配置环境
cp .env.example .env.development
# 编辑 .env.development 配置数据库等信息

# 4. 启动开发服务器
npm run dev
```

### 生产部署

#### 方式一：阿里云一键部署（推荐）

```bash
# 在服务器上运行
curl -fsSL https://raw.githubusercontent.com/Bavoch/huitong-material-deploy/main/deploy.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh production YOUR_SERVER_IP
```

#### 方式二：Docker 部署

```bash
# 1. 配置生产环境
cp .env.production.example .env.production
# 编辑 .env.production

# 2. 启动服务
docker-compose up -d
```

## 📋 可用命令

### 开发命令
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run preview      # 预览构建结果
```

## 🔧 环境配置

创建 `.env.production` 文件：

```env
NODE_ENV=production
PORT=3004
DATABASE_URL="file:./prisma/prod.db"
CORS_ORIGIN=*
UPLOAD_DIR=./backend/uploads
MAX_FILE_SIZE=100MB
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
JWT_SECRET=your-jwt-secret-key-change-this-in-production
LOG_LEVEL=info
MAX_CONNECTIONS=100
REQUEST_TIMEOUT=30000
```

## 📊 功能特性

- ✅ 3D 材质预览和管理
- ✅ 文件上传和存储
- ✅ 自动化部署流程
- ✅ Docker 容器化
- ✅ 数据库集成
- ✅ 响应式设计

## 🛠️ 技术栈

- **前端**: React + TypeScript + Three.js + Vite
- **后端**: Node.js + Express + Prisma
- **数据库**: SQLite (生产环境可配置 PostgreSQL)
- **部署**: Docker + Nginx

## 📞 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   sudo netstat -tulpn | grep :3004
   sudo kill -9 <PID>
   ```

2. **数据库连接失败**
   ```bash
   docker-compose logs app
   docker-compose restart
   ```

3. **服务无法访问**
   ```bash
   docker-compose ps
   curl http://localhost:3004/health
   ```

## 📄 许可证

MIT License

---

🎉 **快速部署，简单管理！**