# 阿里云部署指南

本文档详细说明如何将会通材质管理系统部署到阿里云服务器。

## 🏗️ 架构概览

```
Internet
    ↓
Nginx (反向代理 + SSL终止)
    ↓
Node.js应用 (Express + React)
    ↓
PostgreSQL数据库 (阿里云RDS)
```

## 📋 前置要求

### 阿里云资源

1. **ECS实例**
   - 推荐配置: 2核4GB内存，40GB系统盘
   - 操作系统: CentOS 7.x 或 Ubuntu 20.04+
   - 安全组开放端口: 22, 80, 443

2. **RDS PostgreSQL实例**
   - 版本: PostgreSQL 12+
   - 配置: 根据业务需求选择
   - 网络: 与ECS在同一VPC

3. **域名和SSL证书**
   - 域名解析指向ECS公网IP
   - SSL证书（推荐使用阿里云SSL证书服务）

### 本地准备

1. **GitHub仓库**
   - 将代码推送到GitHub仓库
   - 配置GitHub Secrets（见下文）

## 🚀 部署步骤

### 步骤1: 创建阿里云资源

#### 1.1 创建ECS实例

```bash
# 使用阿里云CLI创建ECS实例（可选）
aliyun ecs RunInstances \
  --RegionId cn-hangzhou \
  --ImageId centos_7_9_x64_20G_alibase_20210318.vhd \
  --InstanceType ecs.t5-lc1m2.small \
  --SecurityGroupId sg-xxxxxxxxx \
  --VSwitchId vsw-xxxxxxxxx \
  --InstanceName huitong-material-server \
  --InternetMaxBandwidthOut 5
```

#### 1.2 创建RDS实例

```bash
# 使用阿里云CLI创建RDS实例（可选）
aliyun rds CreateDBInstance \
  --RegionId cn-hangzhou \
  --Engine PostgreSQL \
  --EngineVersion 12.0 \
  --DBInstanceClass rds.pg.s1.small \
  --DBInstanceStorage 20 \
  --DBInstanceNetType Intranet \
  --PayType Postpaid
```

### 步骤2: 配置GitHub Secrets

在GitHub仓库设置中添加以下Secrets:

```
ALIYUN_HOST=your-ecs-public-ip
ALIYUN_USERNAME=root
ALIYUN_SSH_KEY=your-private-ssh-key
ALIYUN_PORT=22
```

### 步骤3: 服务器初始化

#### 3.1 连接到ECS服务器

```bash
ssh root@your-ecs-public-ip
```

#### 3.2 运行部署脚本

```bash
# 下载并运行部署脚本
curl -fsSL https://raw.githubusercontent.com/Bavoch/huitong-material-deploy/main/deploy.sh | bash
```

或者手动执行：

```bash
# 克隆仓库
git clone https://github.com/Bavoch/huitong-material-deploy.git /opt/huitong-material
cd /opt/huitong-material

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 步骤4: 配置环境变量

编辑 `/opt/huitong-material/.env` 文件：

```bash
vi /opt/huitong-material/.env
```

更新数据库连接信息：

```env
# 数据库配置
POSTGRES_USER=your_rds_username
POSTGRES_PASSWORD=your_rds_password
POSTGRES_DB=huitong_material
POSTGRES_HOST=your-rds-host.rds.aliyuncs.com
POSTGRES_PORT=5432

# 数据库连接URL
POSTGRES_PRISMA_URL=postgresql://username:password@your-rds-host.rds.aliyuncs.com:5432/huitong_material?schema=public&sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://username:password@your-rds-host.rds.aliyuncs.com:5432/huitong_material?schema=public&sslmode=require
```

### 步骤5: 配置SSL证书

将SSL证书文件放置到服务器：

```bash
# 创建SSL目录
mkdir -p /opt/huitong-material/ssl

# 上传证书文件（使用scp或其他方式）
scp cert.pem root@your-ecs-ip:/opt/huitong-material/ssl/
scp key.pem root@your-ecs-ip:/opt/huitong-material/ssl/
```

### 步骤6: 启动服务

```bash
cd /opt/huitong-material
docker-compose up -d
```

### 步骤7: 初始化数据库

```bash
# 运行数据库迁移
docker-compose exec app npx prisma db push
```

## 🔧 配置说明

### 环境变量配置

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 应用端口 | `3001` |
| `POSTGRES_HOST` | 数据库主机 | `xxx.rds.aliyuncs.com` |
| `POSTGRES_USER` | 数据库用户 | `huitong_user` |
| `POSTGRES_PASSWORD` | 数据库密码 | `your_password` |
| `POSTGRES_DB` | 数据库名 | `huitong_material` |

### 安全组配置

确保ECS安全组开放以下端口：

- 22: SSH访问
- 80: HTTP访问
- 443: HTTPS访问

### RDS配置

1. 创建数据库用户和数据库
2. 配置白名单，允许ECS内网IP访问
3. 启用SSL连接（推荐）

## 📊 监控和维护

### 查看服务状态

```bash
cd /opt/huitong-material
docker-compose ps
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f nginx
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart app
```

### 更新应用

```bash
cd /opt/huitong-material
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 备份数据库

```bash
# 创建数据库备份
docker-compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 🚨 故障排除

### 常见问题

1. **服务无法启动**
   - 检查环境变量配置
   - 查看Docker日志
   - 确认端口未被占用

2. **数据库连接失败**
   - 检查RDS连接信息
   - 确认安全组和白名单配置
   - 验证SSL设置

3. **SSL证书问题**
   - 确认证书文件路径正确
   - 检查证书有效期
   - 验证域名解析

### 日志位置

- 应用日志: `docker-compose logs app`
- Nginx日志: `docker-compose logs nginx`
- 数据库日志: `docker-compose logs postgres`

## 📈 性能优化

### 建议配置

1. **ECS实例**
   - 生产环境推荐4核8GB内存
   - 使用SSD云盘提升I/O性能

2. **RDS配置**
   - 根据并发量选择合适规格
   - 启用读写分离（如需要）
   - 配置自动备份

3. **CDN加速**
   - 使用阿里云CDN加速静态资源
   - 配置缓存策略

## 🔐 安全建议

1. **服务器安全**
   - 定期更新系统补丁
   - 配置防火墙规则
   - 使用密钥认证替代密码

2. **应用安全**
   - 定期更新依赖包
   - 配置HTTPS强制跳转
   - 实施访问控制

3. **数据库安全**
   - 使用强密码
   - 启用SSL连接
   - 定期备份数据

## 📞 技术支持

如遇到部署问题，请：

1. 查看本文档的故障排除部分
2. 检查GitHub Issues
3. 联系技术支持团队