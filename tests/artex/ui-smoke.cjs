// Real Chromium + backend acceptance check. No npm dependencies or mock responses.
// --initialize claims only an uninitialized local instance; never resets passwords.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const work = path.join(root, 'var/artex');
const origin = 'http://127.0.0.1:8787';
const passwordPath = path.join(work, 'admin-password');
const compose = ['compose', '-p', 'agenttic-artex-ui', '--env-file',
  path.join(work, 'runtime.env'), '-f', path.join(root, 'src/artex/compose.yaml')];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
let browserLog;
let profile;
const pending = new Map();
let nextId = 0;

function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer, method });
    browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}

async function main() {
  process.umask(0o077);
  const initialized = (await (await fetch(`${origin}/api/auth/status`)).json()).initialized;
  assert.equal(typeof initialized, 'boolean', 'DB-backed initialization state must be available');
  assert.equal((await fetch(`${origin}/api/tasks`)).status, 401, 'Unauthenticated tasks must be denied');
  let setupToken;
  if (!initialized) {
    assert(process.argv.includes('--initialize'), 'Run make init for first-time setup');
    const logs = execFileSync('docker', [...compose, 'logs', '--no-color', 'artex'], { encoding: 'utf8' });
    const matches = [...logs.matchAll(/Setup token for the \/setup page: ([a-f0-9]+)/g)];
    assert(matches.length > 0, 'Expected one-time token in local backend logs');
    setupToken = matches.at(-1)[1];
    // Exclusive creation protects a previously generated credential after interrupted setup.
    if (!fs.existsSync(passwordPath)) fs.writeFileSync(passwordPath, randomBytes(24).toString('hex') + '\n', { mode: 0o600, flag: 'wx' });
  }
  const adminPassphrase = fs.readFileSync(passwordPath, 'utf8').trim();
  assert(adminPassphrase.length >= 12 && adminPassphrase.length <= 72, 'Expected local administrator password');
  assert.equal(fs.statSync(passwordPath).mode & 0o077, 0, 'Password must not be group/world readable');

  profile = fs.mkdtempSync(path.join(work, 'browser-profile-'));
  browserLog = fs.openSync(path.join(work, 'evidence/browser.log'), 'a', 0o600);
  browser = spawn(process.env.CHROMIUM_BIN || 'chromium', [
    '--headless', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
    '--disable-extensions', '--disable-sync', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
  ], { stdio: ['ignore', browserLog, browserLog, 'pipe', 'pipe'] });
  let buffer = '';
  browser.stdio[4].on('data', chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`Browser command failed: ${waiter.method} (${message.error.code})`));
      else waiter.resolve(message.result);
    }
  });
  browser.on('error', () => { for (const p of pending.values()) p.reject(new Error('Chromium failed to start')); });
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    assert(!result.exceptionDetails, 'Browser evaluation failed (details omitted to protect credentials)');
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (await evaluate(expression)) return;
      await delay(250);
    }
    const pagePath = await evaluate('location.pathname');
    throw new Error(`Browser did not reach: ${label} (path: ${pagePath})`);
  };
  const fill = async (id, value) => evaluate(`(() => {
    const input = document.getElementById(${JSON.stringify(id)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const submit = async () => {
    await waitFor("document.querySelector('button[type=submit]')?.disabled === false", 'enabled submit');
    await evaluate("document.querySelector('button[type=submit]').click()");
    // The upstream static export sets trailingSlash: true.
    await waitFor("['/function/tasks', '/function/tasks/'].includes(location.pathname) && document.body.innerText.includes('Current tasks')", 'authenticated tasks UI');
  };

  if (!initialized) {
    await command('Page.navigate', { url: `${origin}/setup` }, sessionId);
    await waitFor("!!document.getElementById('setup-token')", 'setup form');
    await fill('setup-token', setupToken);
    await fill('password', adminPassphrase);
    await fill('confirm', adminPassphrase);
    await submit();
    console.log('PASS: initial administrator setup through WebUI');
  }
  await command('Storage.clearDataForOrigin', { origin, storageTypes: 'all' }, sessionId);
  await command('Network.clearBrowserCookies', {}, sessionId);
  await command('Page.navigate', { url: `${origin}/login` }, sessionId);
  await waitFor("!!document.getElementById('agree-terms')", 'login form');
  await fill('password', adminPassphrase);
  await evaluate("document.getElementById('agree-terms').click()");
  await submit();
  console.log('PASS: fresh browser login and rendered Tasks page');
  const state = await evaluate(`(async () => {
    const headers = { Authorization: 'Bearer ' + localStorage.getItem('artex_token') };
    const get = async p => { const r = await fetch(p, { headers }); if (!r.ok) throw Error('API failed'); return r.json(); };
    const [tasks, llm, health] = await Promise.all([get('/api/tasks'), get('/api/llm'), get('/api/health')]);
    return { count: tasks.tasks.length, configured: llm.configured, keySet: llm.key_set, version: health.version };
  })()`);
  assert.equal(state.count, 0, 'UI-only trial must not create assessment tasks');
  assert.equal(state.configured, false, 'Model must remain disconnected');
  assert.equal(state.keySet, false, 'No model key may be set');
  const revision = fs.readFileSync(path.join(work, 'source-revision'), 'utf8').trim();
  assert.equal(state.version, revision, 'Running binary must identify the pinned source');
  const screenshot = await command('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.writeFileSync(path.join(work, 'evidence/tasks.png'), Buffer.from(screenshot.data, 'base64'), { mode: 0o600 });
  console.log('PASS: real authenticated API, pinned version, zero tasks and no model credentials');
  fs.writeFileSync(path.join(work, 'evidence/ui-check.json'), JSON.stringify({ checkedAt: new Date().toISOString(), ...state, result: 'PASS' }, null, 2) + '\n', { mode: 0o600 });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) {
    try { await command('Browser.close'); } catch { browser.kill('SIGTERM'); }
    // Let Chromium release its profile before removing this test's temporary session.
    for (let attempt = 0; attempt < 20 && browser.exitCode === null; attempt++) await delay(100);
    if (browser.exitCode !== null && profile) fs.rmSync(profile, { recursive: true, force: true });
  }
  for (const p of pending.values()) clearTimeout(p.timer);
  if (browserLog !== undefined) fs.closeSync(browserLog);
});
