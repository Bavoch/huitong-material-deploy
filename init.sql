-- 数据库初始化脚本
-- 用于本地Docker PostgreSQL容器初始化

-- 创建数据库（如果不存在）
-- 注意：如果使用阿里云RDS，通常不需要手动创建用户，只需要创建数据库

-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 创建扩展（如果需要）
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 这里可以添加其他初始化SQL语句
-- 例如：创建初始用户、设置权限等

-- 注意：Prisma会自动处理表结构的创建和迁移
-- 所以这里不需要手动创建表