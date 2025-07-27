#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

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

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  log('🚀 GitHub 上传助手', 'blue');
  log('==================', 'blue');
  
  // 获取 GitHub 用户名
  const username = await question(`${colors.cyan}请输入你的 GitHub 用户名: ${colors.reset}`);
  
  if (!username) {
    log('❌ GitHub 用户名不能为空', 'red');
    rl.close();
    return;
  }
  
  log(`\n📋 准备上传到: https://github.com/${username}/netsniffer`, 'cyan');
  
  // 确认操作
  const confirm = await question(`${colors.yellow}确认上传？(y/N): ${colors.reset}`);
  
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    log('❌ 操作已取消', 'red');
    rl.close();
    return;
  }
  
  try {
    // 检查是否已经配置了远程仓库
    try {
      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      log(`📡 当前远程仓库: ${remoteUrl}`, 'cyan');
      
      const updateRemote = await question(`${colors.yellow}是否更新远程仓库地址？(y/N): ${colors.reset}`);
      if (updateRemote.toLowerCase() === 'y' || updateRemote.toLowerCase() === 'yes') {
        execCommand(`git remote set-url origin https://github.com/${username}/netsniffer.git`, '更新远程仓库地址');
      }
    } catch (error) {
      // 没有配置远程仓库，添加新的
      execCommand(`git remote add origin https://github.com/${username}/netsniffer.git`, '添加远程仓库');
    }
    
    // 推送代码
    execCommand('git push -u origin main', '推送代码到 GitHub');
    
    // 创建第一个版本
    const createRelease = await question(`${colors.yellow}是否创建第一个发布版本？(y/N): ${colors.reset}`);
    
    if (createRelease.toLowerCase() === 'y' || createRelease.toLowerCase() === 'yes') {
      log('\n📦 创建第一个发布版本...', 'cyan');
      execCommand('node scripts/release.js patch', '创建补丁版本');
      execCommand('git push origin main', '推送版本更新');
      execCommand('git push origin v1.0.1', '推送版本标签');
    }
    
    log('\n🎉 上传完成！', 'green');
    log('\n📝 下一步操作:', 'cyan');
    log('1. 访问 https://github.com/' + username + '/netsniffer', 'cyan');
    log('2. 在仓库设置中添加描述和主题标签', 'cyan');
    log('3. 启用 GitHub Actions', 'cyan');
    log('4. 检查构建状态', 'cyan');
    
    log('\n📚 详细指南请参考: docs/GITHUB_SETUP.md', 'yellow');
    
  } catch (error) {
    log(`❌ 上传过程中出现错误: ${error.message}`, 'red');
  } finally {
    rl.close();
  }
}

main(); 