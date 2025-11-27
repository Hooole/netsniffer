/* eslint-disable @typescript-eslint/no-var-requires */
process.env.ELECTRON_RUN_AS_NODE = '1';

import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
const Module = require('module');

// 注入 asar 与解包的 node_modules 到模块查找路径
try {
  const resourcesPath = (process as any).resourcesPath || '';
  const unpackedNodeModules = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
  const asarNodeModules = path.join(resourcesPath, 'app.asar', 'node_modules');
  const candidates: string[] = [];
  if (unpackedNodeModules && fs.existsSync(unpackedNodeModules))
    candidates.push(unpackedNodeModules);
  if (asarNodeModules && fs.existsSync(asarNodeModules)) candidates.push(asarNodeModules);
  if (candidates.length) {
    const prev = process.env.NODE_PATH ? process.env.NODE_PATH + require('path').delimiter : '';
    process.env.NODE_PATH = prev + candidates.join(require('path').delimiter);
    // 注入到当前模块查找路径
    try {
      (module as any).paths.unshift(...candidates);
    } catch {}
    try {
      Array.prototype.unshift.apply(Module.globalPaths, candidates);
    } catch {}
    Module._initPaths?.();
  }
} catch {}

function sendFast(type: string, message?: string) {
  try {
    /* @ts-ignore */ if (process.parentPort)
      return process.parentPort.postMessage({ type, message });
  } catch {}
  try {
    /* @ts-ignore */ if (process.send) return process.send({ type, message });
  } catch {}
}

function resolveWhistle(preferred?: string): any {
  // 1) 直接 require 模块名（命中 asar 内 node_modules）
  try {
    return require('whistle');
  } catch {}

  // 2) 若有绝对入口，使用 createRequire 以该目录为根加载模块
  if (preferred && fs.existsSync(preferred)) {
    try {
      const base = path.dirname(preferred);
      const anchor = path.join(base, 'package.json');
      const cr = Module.createRequire(fs.existsSync(anchor) ? anchor : preferred);
      try {
        return cr('whistle');
      } catch {}
      try {
        return cr('./index.js');
      } catch {}
    } catch {}
  }

  // 3) 使用 createRequire 锚定到解包 node_modules 根，再按模块名加载
  try {
    const roots = [
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules'),
      path.join(process.resourcesPath || '', 'app.asar', 'node_modules'),
    ];
    for (const root of roots) {
      try {
        if (fs.existsSync(root)) {
          const cr = Module.createRequire(path.join(root, '__loader__.js'));
          return cr('whistle');
        }
      } catch {}
    }
  } catch {}

  // 4) 兜底：多路径扫描
  try {
    const candidates = [
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules'),
      path.join(process.resourcesPath || '', 'app.asar', 'node_modules'),
      path.join(process.resourcesPath || '', 'node_modules'),
      path.join(__dirname, '..', 'node_modules'),
    ].filter(Boolean);
    for (const base of candidates) {
      try {
        const resolved = require.resolve('whistle', { paths: [base] });
        if (resolved) return require(resolved);
      } catch {}
    }
  } catch {}

  throw new Error('Cannot resolve whistle module');
}

type StartMsg = {
  type: string;
  [k: string]: any;
};

function send(msg: StartMsg) {
  try {
    // @ts-ignore
    if (process.parentPort) return process.parentPort.postMessage(msg);
  } catch {}
  try {
    // 回退：使用 IPC 通道 message
    // @ts-ignore
    if (process.send) return process.send(msg);
  } catch {}
}

function parseOptions(): {
  port: number;
  host: string;
  storage: string;
  mode?: string;
  whistleEntry?: string;
  userDataDir?: string;
} {
  try {
    const raw = process.argv[2];
    const json = raw ? JSON.parse(decodeURIComponent(raw)) : {};
    return {
      port: Number(json.port) || 8899,
      host: json.host || '127.0.0.1',
      storage: json.storage || '',
      mode: json.mode || 'capture',
      whistleEntry: json.whistleEntry || '',
      userDataDir: json.userDataDir || '',
    };
  } catch {
    return {
      port: 8899,
      host: '127.0.0.1',
      storage: '',
      mode: 'capture',
      whistleEntry: '',
      userDataDir: '',
    };
  }
}

(async () => {
  try {
    const opts = parseOptions();
    // 调试：回传关键路径信息
    send({
      type: 'debug',
      preferred: opts.whistleEntry,
      resourcesPath: (process as any).resourcesPath,
      dirname: __dirname,
    });
    if (opts.storage) {
      try {
        fs.mkdirSync(opts.storage, { recursive: true });
      } catch {}
    }

    let proxy: any;
    try {
      const startWhistle = resolveWhistle(opts.whistleEntry);
      const baseOptions = {
        baseDir: opts.storage || '',
        port: opts.port,
        host: opts.host,
        mode: 'client|disableUpdateTips|disableAuthUI',
        shadowRules: '',
        disableInstaller: true,
      };

      proxy = startWhistle(
        {
          ...baseOptions,
          handleWebReq(req: any, res: any) {
            return false; // 不接管根路径，避免与应用自己的 renderer 冲突
          },
        },
        () => {
          let rootCAFile: string | undefined;
          try {
            rootCAFile =
              (proxy &&
                proxy.httpsUtil &&
                proxy.httpsUtil.getRootCAFile &&
                proxy.httpsUtil.getRootCAFile()) ||
              undefined;
          } catch {}
          send({ type: 'ready', options: { ...baseOptions, rootCAFile } });
          try {
            proxy.rulesUtil.properties.setEnableCapture(true);
          } catch {}
        }
      );
    } catch (e) {
      // 回退：直接以编程方式 fork whistle 的 index.js（非 CLI），避免 pfork/参数差异
      const resources = (process as any).resourcesPath || '';
      const whistleDir = path.join(resources, 'app.asar.unpacked', 'node_modules', 'whistle');
      const entryCandidates = [opts.whistleEntry || '', path.join(whistleDir, 'index.js')].filter(
        Boolean
      );
      const entry = entryCandidates.find((p) => fs.existsSync(p));
      if (!entry) {
        throw e; // 保持原错误
      }
      const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' } as NodeJS.ProcessEnv;
      const child: ChildProcess = spawn(
        process.execPath,
        [
          entry,
          'run',
          '-p',
          String(opts.port),
          '-H',
          opts.host,
          '-S',
          opts.storage || '',
          '-M',
          'capture',
          '--no-global-plugins',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], env }
      );
      const onData = (buf: Buffer) => {
        const line = String(buf || '').trim();
        // 简单就绪判定
        if (/whistle started|proxy server started|Server started|started on port/i.test(line)) {
          send({
            type: 'ready',
            options: { port: opts.port, host: opts.host, baseDir: opts.storage || '' },
          });
        }
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      // 监听退出
      child.once('exit', () => {});
      // 接管 exitWhistle
      // @ts-ignore
      (process.parentPort || process).on('message', (data: any) => {
        const msg = data && (data.data || data);
        if (msg && msg.type === 'exitWhistle') {
          try {
            child.kill();
          } catch {}
          process.exit(0);
        }
      });
      return; // 不再继续后续逻辑
    }

    // 处理主进程发来的控制消息
    // @ts-ignore
    (process.parentPort || process).on('message', (data: any) => {
      const msg = data && (data.data || data);
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'exitWhistle') {
        process.exit(0);
      }
      if (msg.type === 'refreshPlugins') {
        try {
          proxy.pluginMgr.refreshPlugins();
        } catch {}
      }
      if (msg.type === 'enableCapture') {
        try {
          proxy.rulesUtil.properties.setEnableCapture(true);
        } catch {}
      }
    });
  } catch (e: any) {
    send({ type: 'error', message: (e && (e.stack || e.message)) || String(e) });
    process.exit(1);
  }
})();
