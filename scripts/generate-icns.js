#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const png2icons = require('png2icons');

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

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if ((key === '--input' || key === '-i') && val) {
      args.input = val;
      i++;
    } else if ((key === '--output' || key === '-o') && val) {
      args.output = val;
      i++;
    } else if (key === '--help' || key === '-h') {
      args.help = true;
    }
  }
  return args;
}

function showHelp() {
  console.log(`\n使用方法:\n  node scripts/generate-icns.js --input ./src/assets/icon.png --output ./src/assets/icon.icns\n\n参数:\n  -i, --input   源 PNG 图标，建议 1024x1024（默认: ./src/assets/icon.png）\n  -o, --output  目标 ICNS 路径（默认: ./src/assets/icon.icns）\n`);
}

function main() {
  const args = parseArgs();
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const projectRoot = process.cwd();
  const inputPath = path.resolve(projectRoot, args.input || 'src/assets/icon.png');
  const outputPath = path.resolve(projectRoot, args.output || 'src/assets/icon.icns');

  log('🖼  生成 macOS ICNS 图标', 'blue');
  log(`输入: ${inputPath}`, 'cyan');
  log(`输出: ${outputPath}`, 'cyan');

  if (!fs.existsSync(inputPath)) {
    log(`找不到输入文件: ${inputPath}`, 'red');
    process.exit(1);
  }

  try {
    const pngBuffer = fs.readFileSync(inputPath);
    const icnsBuffer = png2icons.createICNS(pngBuffer, png2icons.BILINEAR, 0);
    if (!icnsBuffer) {
      log('转换失败：请确认输入 PNG 为正方形且分辨率足够（建议 1024x1024）。', 'red');
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, icnsBuffer);
    log('✅ 生成成功！', 'green');
  } catch (err) {
    log(`❌ 生成失败：${err.message}`, 'red');
    process.exit(1);
  }
}

main();

