#!/usr/bin/env node
/**
 * 调试运行中的 DeepSeek Harness 界面（基于 Chromium DevTools Protocol）。
 *
 * 先用调试端口启动应用（只在本机 127.0.0.1 监听，用完请正常重启关掉）：
 *   osascript -e 'quit app "DeepSeek Harness"'
 *   open -a "DeepSeek Harness" --args --remote-debugging-port=9333
 *
 * 用法：
 *   node tools/devtools.mjs eval '<JS 表达式>'      在页面里执行并打印结果
 *   node tools/devtools.mjs shot out.png            截取窗口
 *   node tools/devtools.mjs css path/to/dev.css     实时注入 CSS（覆盖同一个 <style>，不改安装文件）
 *   node tools/devtools.mjs live                    把当前构建的 skin.css 实时注入（免重启预览）
 *
 * 环境变量 DSH_DEBUG_PORT 可改端口，默认 9333。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.DSH_DEBUG_PORT || '9333';

async function connect() {
  let pages;
  try {
    pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  } catch {
    throw new Error(`连不上 127.0.0.1:${PORT}，请先用 --remote-debugging-port=${PORT} 启动 DeepSeek Harness`);
  }
  const page = pages.find((entry) => entry.type === 'page');
  if (!page) throw new Error('没有找到页面目标');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  };
  await new Promise((done) => { ws.onopen = done; });
  const send = (method, params = {}) => new Promise((done) => {
    id += 1;
    pending.set(id, done);
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => ws.close() };
}

async function evaluate(send, expression) {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description ?? 'evaluate failed');
  return reply.result?.result?.value;
}

function injectExpression(css) {
  return `(() => {
    let style = document.getElementById('dsh-devtools-css');
    if (!style) { style = document.createElement('style'); style.id = 'dsh-devtools-css'; document.head.appendChild(style); }
    style.textContent = ${JSON.stringify(css)};
    return 'injected ' + style.textContent.length + ' chars';
  })()`;
}

/** 从已构建的 dist/client.js 里取出展开后的皮肤 CSS。 */
function builtSkinCss() {
  const bundle = readFileSync(join(ROOT, 'brand-override', 'dist', 'client.js'), 'utf8');
  const match = /var themeCss = ("(?:\\.|[^"\\])*");/.exec(bundle);
  if (!match) throw new Error('dist/client.js 里没有 themeCss，先运行 node tools/build.mjs');
  return JSON.parse(match[1]);
}

const [command, arg] = process.argv.slice(2);
const { send, close } = await connect();
try {
  if (command === 'eval') {
    const value = await evaluate(send, arg);
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  } else if (command === 'shot') {
    const reply = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(arg || 'dsh-shot.png', Buffer.from(reply.result.data, 'base64'));
    console.log('saved', arg || 'dsh-shot.png');
  } else if (command === 'css') {
    console.log(await evaluate(send, injectExpression(readFileSync(arg, 'utf8'))));
  } else if (command === 'live') {
    console.log(await evaluate(send, injectExpression(builtSkinCss())));
  } else {
    console.log('用法见文件头注释：eval | shot | css | live');
    process.exitCode = 1;
  }
} finally {
  close();
}
