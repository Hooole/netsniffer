#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${colors.cyan}${description}...${colors.reset}`);
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} 完成`, 'green');
  } catch (error) {
    log(`❌ ${description} 失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 获取当前版本
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return packageJson.version;
}

// 更新版本号
function updateVersion(type) {
  const currentVersion = getCurrentVersion();
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    default:
      log('❌ 无效的版本类型，请使用 major, minor, 或 patch', 'red');
      process.exit(1);
  }
  
  return newVersion;
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    log('使用方法: node scripts/release.js <command>', 'yellow');
    log('可用命令:', 'yellow');
    log('  patch  - 发布补丁版本 (1.0.0 -> 1.0.1)', 'cyan');
    log('  minor  - 发布次要版本 (1.0.0 -> 1.1.0)', 'cyan');
    log('  major  - 发布主要版本 (1.0.0 -> 2.0.0)', 'cyan');
    log('  build  - 构建所有平台应用', 'cyan');
    log('  publish - 构建并发布到GitHub', 'cyan');
    process.exit(1);
  }
  
  switch (command) {
    case 'patch':
    case 'minor':
    case 'major':
      releaseVersion(command);
      break;
    case 'build':
      buildAll();
      break;
    case 'publish':
      publish();
      break;
    default:
      log(`❌ 未知命令: ${command}`, 'red');
      process.exit(1);
  }
}

function releaseVersion(type) {
  const newVersion = updateVersion(type);
  const tagName = `v${newVersion}`;
  
  log(`🚀 准备发布版本 ${newVersion}`, 'blue');
  
  // 检查是否有未提交的更改
  try {
    execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
  } catch (error) {
    log('❌ 有未提交的更改，请先提交或暂存更改', 'red');
    process.exit(1);
  }
  
  // 更新 package.json 版本
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  
  // 提交版本更新
  execCommand('git add package.json', '添加版本更新');
  execCommand(`git commit -m "chore: bump version to ${newVersion}"`, '提交版本更新');
  
  // 创建标签
  execCommand(`git tag -a ${tagName} -m "Release ${newVersion}"`, '创建版本标签');
  
  log(`\n🎉 版本 ${newVersion} 已准备就绪！`, 'green');
  log('下一步:', 'cyan');
  log(`1. 推送代码: git push origin main`, 'cyan');
  log(`2. 推送标签: git push origin ${tagName}`, 'cyan');
  log('3. GitHub Actions 将自动构建和发布', 'cyan');
}

function buildAll() {
  log('🏗️ 构建所有平台应用', 'blue');
  
  // 检查依赖
  if (!fs.existsSync('node_modules')) {
    execCommand('npm install', '安装依赖');
  }
  
  if (!fs.existsSync('frontend/node_modules')) {
    execCommand('cd frontend && npm install && cd ..', '安装前端依赖');
  }
  
  // 构建前端
  execCommand('npm run build:frontend', '构建前端');
  
  // 构建所有平台
  execCommand('npm run build:all', '构建所有平台应用');
  
  log('\n🎉 构建完成！', 'green');
  log('构建文件位于 dist/ 目录', 'cyan');
}

function publish() {
  log('🚀 构建并发布应用', 'blue');
  
  // 构建应用
  buildAll();
  
  // 检查是否有标签
  try {
    const currentTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    log(`📦 当前标签: ${currentTag}`, 'cyan');
  } catch (error) {
    log('❌ 没有找到版本标签，请先运行 release 命令', 'red');
    process.exit(1);
  }
  
  log('\n📝 发布说明:', 'cyan');
  log('1. 推送代码到 GitHub', 'cyan');
  log('2. 推送标签触发自动构建', 'cyan');
  log('3. 检查 GitHub Actions 构建状态', 'cyan');
  log('4. 在 GitHub Releases 中查看发布', 'cyan');
}

// 运行主函数
main(); 