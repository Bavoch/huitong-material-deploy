#!/usr/bin/env node

/**
 * 阿里云一键部署脚本
 * 自动创建和配置阿里云资源，用于部署会通材质管理系统
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置参数
const CONFIG = {
  region: 'cn-hangzhou',
  instanceType: 'ecs.t5-lc1m2.small',
  imageId: 'centos_7_9_x64_20G_alibase_20210318.vhd',
  internetMaxBandwidthOut: 5,
  systemDiskSize: 40,
  rdsInstanceClass: 'rds.pg.s1.small',
  rdsStorage: 20,
  rdsEngine: 'PostgreSQL',
  rdsEngineVersion: '12.0'
};

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n执行: ${description}`, 'blue');
  log(`命令: ${command}`, 'yellow');
  
  try {
    const result = execSync(command, { encoding: 'utf8' });
    log('✅ 执行成功', 'green');
    return result;
  } catch (error) {
    log(`❌ 执行失败: ${error.message}`, 'red');
    throw error;
  }
}

function checkPrerequisites() {
  log('\n🔍 检查前置条件...', 'blue');
  
  try {
    execSync('aliyun --version', { stdio: 'ignore' });
    log('✅ 阿里云CLI已安装', 'green');
  } catch {
    log('❌ 请先安装阿里云CLI: https://help.aliyun.com/document_detail/121541.html', 'red');
    process.exit(1);
  }
  
  try {
    execSync('docker --version', { stdio: 'ignore' });
    log('✅ Docker已安装', 'green');
  } catch {
    log('❌ 请先安装Docker', 'red');
    process.exit(1);
  }
}

function createVPC() {
  log('\n🌐 创建VPC和交换机...', 'blue');
  
  // 创建VPC
  const vpcResult = execCommand(
    `aliyun ecs CreateVpc --RegionId ${CONFIG.region} --CidrBlock 172.16.0.0/16 --VpcName huitong-material-vpc`,
    '创建VPC'
  );
  
  const vpcId = JSON.parse(vpcResult).VpcId;
  log(`VPC ID: ${vpcId}`, 'green');
  
  // 等待VPC创建完成
  execCommand('sleep 10', '等待VPC创建完成');
  
  // 创建交换机
  const vswitchResult = execCommand(
    `aliyun ecs CreateVSwitch --RegionId ${CONFIG.region} --VpcId ${vpcId} --CidrBlock 172.16.1.0/24 --ZoneId ${CONFIG.region}-g --VSwitchName huitong-material-vswitch`,
    '创建交换机'
  );
  
  const vswitchId = JSON.parse(vswitchResult).VSwitchId;
  log(`VSwitch ID: ${vswitchId}`, 'green');
  
  return { vpcId, vswitchId };
}

function createSecurityGroup(vpcId) {
  log('\n🔒 创建安全组...', 'blue');
  
  // 创建安全组
  const sgResult = execCommand(
    `aliyun ecs CreateSecurityGroup --RegionId ${CONFIG.region} --VpcId ${vpcId} --SecurityGroupName huitong-material-sg --Description "Security group for huitong material system"`,
    '创建安全组'
  );
  
  const securityGroupId = JSON.parse(sgResult).SecurityGroupId;
  log(`Security Group ID: ${securityGroupId}`, 'green');
  
  // 添加安全组规则
  const rules = [
    { port: '22', description: 'SSH' },
    { port: '80', description: 'HTTP' },
    { port: '443', description: 'HTTPS' }
  ];
  
  for (const rule of rules) {
    execCommand(
      `aliyun ecs AuthorizeSecurityGroup --RegionId ${CONFIG.region} --SecurityGroupId ${securityGroupId} --IpProtocol tcp --PortRange ${rule.port}/${rule.port} --SourceCidrIp 0.0.0.0/0`,
      `添加${rule.description}规则`
    );
  }
  
  return securityGroupId;
}

function createECSInstance(vswitchId, securityGroupId) {
  log('\n💻 创建ECS实例...', 'blue');
  
  const instanceResult = execCommand(
    `aliyun ecs RunInstances --RegionId ${CONFIG.region} --ImageId ${CONFIG.imageId} --InstanceType ${CONFIG.instanceType} --SecurityGroupId ${securityGroupId} --VSwitchId ${vswitchId} --InstanceName huitong-material-server --InternetMaxBandwidthOut ${CONFIG.internetMaxBandwidthOut} --SystemDisk.Size ${CONFIG.systemDiskSize} --Amount 1`,
    '创建ECS实例'
  );
  
  const instanceId = JSON.parse(instanceResult).InstanceIdSets.InstanceIdSet[0];
  log(`Instance ID: ${instanceId}`, 'green');
  
  // 等待实例启动
  log('等待实例启动...', 'yellow');
  execCommand('sleep 60', '等待实例启动');
  
  // 获取公网IP
  const instanceInfo = execCommand(
    `aliyun ecs DescribeInstances --RegionId ${CONFIG.region} --InstanceIds '["${instanceId}"]'`,
    '获取实例信息'
  );
  
  const instance = JSON.parse(instanceInfo).Instances.Instance[0];
  const publicIp = instance.PublicIpAddress.IpAddress[0];
  log(`Public IP: ${publicIp}`, 'green');
  
  return { instanceId, publicIp };
}

function createRDSInstance(vpcId, vswitchId) {
  log('\n🗄️ 创建RDS实例...', 'blue');
  
  const rdsResult = execCommand(
    `aliyun rds CreateDBInstance --RegionId ${CONFIG.region} --Engine ${CONFIG.rdsEngine} --EngineVersion ${CONFIG.rdsEngineVersion} --DBInstanceClass ${CONFIG.rdsInstanceClass} --DBInstanceStorage ${CONFIG.rdsStorage} --DBInstanceNetType Intranet --PayType Postpaid --VPCId ${vpcId} --VSwitchId ${vswitchId} --DBInstanceDescription "RDS for huitong material system"`,
    '创建RDS实例'
  );
  
  const rdsInstanceId = JSON.parse(rdsResult).DBInstanceId;
  log(`RDS Instance ID: ${rdsInstanceId}`, 'green');
  
  // 等待RDS实例创建完成
  log('等待RDS实例创建完成...', 'yellow');
  execCommand('sleep 300', '等待RDS实例创建完成');
  
  // 获取RDS连接地址
  const rdsInfo = execCommand(
    `aliyun rds DescribeDBInstanceNetInfo --DBInstanceId ${rdsInstanceId}`,
    '获取RDS连接信息'
  );
  
  const rdsHost = JSON.parse(rdsInfo).DBInstanceNetInfos.DBInstanceNetInfo[0].ConnectionString;
  log(`RDS Host: ${rdsHost}`, 'green');
  
  return { rdsInstanceId, rdsHost };
}

function generateEnvFile(publicIp, rdsHost) {
  log('\n📝 生成环境配置文件...', 'blue');
  
  const envContent = `# 生产环境配置 - 自动生成

# 应用配置
NODE_ENV=production
PORT=3001

# 数据库配置
POSTGRES_USER=huitong_user
POSTGRES_PASSWORD=HuiTong@2024!
POSTGRES_DB=huitong_material
POSTGRES_HOST=${rdsHost}
POSTGRES_PORT=5432

# Prisma数据库连接URL
POSTGRES_PRISMA_URL=postgresql://huitong_user:HuiTong@2024!@${rdsHost}:5432/huitong_material?schema=public&sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://huitong_user:HuiTong@2024!@${rdsHost}:5432/huitong_material?schema=public&sslmode=require

# 文件上传配置
UPLOAD_DIR=/app/uploads

# 服务器信息
SERVER_IP=${publicIp}
`;

  fs.writeFileSync('.env.production.generated', envContent);
  log('✅ 环境配置文件已生成: .env.production.generated', 'green');
}

async function main() {
  try {
    log('🚀 开始阿里云一键部署...', 'blue');
    
    // 检查前置条件
    checkPrerequisites();
    
    // 创建VPC和交换机
    const { vpcId, vswitchId } = createVPC();
    
    // 创建安全组
    const securityGroupId = createSecurityGroup(vpcId);
    
    // 创建ECS实例
    const { instanceId, publicIp } = createECSInstance(vswitchId, securityGroupId);
    
    // 创建RDS实例
    const { rdsInstanceId, rdsHost } = createRDSInstance(vpcId, vswitchId);
    
    // 生成环境配置文件
    generateEnvFile(publicIp, rdsHost);
    
    log('\n🎉 阿里云资源创建完成！', 'green');
    log('\n📋 资源信息:', 'blue');
    log(`VPC ID: ${vpcId}`, 'yellow');
    log(`VSwitch ID: ${vswitchId}`, 'yellow');
    log(`Security Group ID: ${securityGroupId}`, 'yellow');
    log(`ECS Instance ID: ${instanceId}`, 'yellow');
    log(`ECS Public IP: ${publicIp}`, 'yellow');
    log(`RDS Instance ID: ${rdsInstanceId}`, 'yellow');
    log(`RDS Host: ${rdsHost}`, 'yellow');
    
    log('\n📝 后续步骤:', 'blue');
    log('1. 等待5-10分钟让RDS实例完全启动', 'yellow');
    log('2. 在RDS控制台创建数据库用户和数据库', 'yellow');
    log('3. 配置RDS白名单，允许ECS内网IP访问', 'yellow');
    log(`4. SSH连接到ECS服务器: ssh root@${publicIp}`, 'yellow');
    log('5. 在服务器上运行部署脚本: curl -fsSL https://raw.githubusercontent.com/Bavoch/huitong-material-deploy/main/deploy.sh | bash', 'yellow');
    log('6. 配置域名解析指向ECS公网IP', 'yellow');
    log('7. 上传SSL证书到服务器', 'yellow');
    
  } catch (error) {
    log(`\n❌ 部署失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}