const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, 'unicom.cookie.js');
const source = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';
const storageKey = 'chinaUnicomCookie';
const endpoint = 'https://m.client.10010.com/mobileService/onLine.htm';

function capture(body, previous = '', options = {}) {
    const request = options.manual ? undefined : {
        url: options.url || endpoint,
        method: options.method || 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    };
    const snapshot = JSON.stringify(request);
    const result = { value: previous, writes: 0, notifications: [], logs: [], completed: [] };
    vm.runInNewContext(source, {
        $request: request,
        $persistentStore: {
            read(key) {
                assert.equal(key, storageKey);
                if (options.throwOnRead) throw new Error('secret-token secret-app');
                return result.value;
            },
            write(value, key) {
                assert.equal(key, storageKey);
                result.writes++;
                if (options.writeFails) return false;
                result.value = value;
                return true;
            },
        },
        $notification: { post: (...args) => result.notifications.push(args) },
        console: { log: (...args) => result.logs.push(args) },
        $done: value => result.completed.push(value),
    });
    assert.equal(result.completed.length, 1, '$done must run exactly once');
    assert.equal(JSON.stringify(result.completed[0]), '{}', 'request must pass through unchanged');
    assert.equal(JSON.stringify(request), snapshot, 'request must not be mutated');
    const output = JSON.stringify([result.notifications, result.logs]);
    assert.ok(!output.includes('secret-token'), 'token must not appear in output');
    assert.ok(!output.includes('secret-app'), 'appId must not appear in output');
    return result;
}

test('capture script exists', () => assert.ok(fs.existsSync(scriptPath)));

test('captures decoded form credentials in Qinglong format', () => {
    const result = capture('version=iphone&token_online=secret-token%2B%3D&appId=secret-app%2F%3D');
    assert.equal(result.value, 'secret-token+=#secret-app/=');
    assert.equal(result.writes, 1);
    assert.equal(result.notifications.length, 1);
});

test('captures JSON bodies without coercing invalid fields', () => {
    const result = capture(JSON.stringify({ token_online: 'secret-token', appId: 'secret-app' }));
    assert.equal(result.value, 'secret-token#secret-app');
});

test('unchanged credentials do not write or notify again', () => {
    const result = capture('token_online=secret-token&appId=secret-app', 'secret-token#secret-app');
    assert.equal(result.writes, 0);
    assert.equal(result.notifications.length, 0);
});

test('supports token-only capture', () => {
    assert.equal(capture('token_online=secret-token').value, 'secret-token');
});

test('preserves a known appId only for the identical token', () => {
    const result = capture('token_online=secret-token', 'secret-token#secret-app');
    assert.equal(result.value, 'secret-token#secret-app');
    assert.equal(result.writes, 0);
});

test('never reuses another token\'s appId', () => {
    assert.equal(capture('token_online=new-token', 'secret-token#secret-app').value, 'new-token');
});

test('replaces both fields when the account changes', () => {
    const result = capture('token_online=new-token&appId=new-app', 'secret-token#secret-app');
    assert.equal(result.value, 'new-token#new-app');
});

for (const body of [
    undefined, '', 'appId=secret-app', 'token_online=',
    'token_online=%ZZ&appId=secret-app', '{"token_online":',
    '{"token_online":123}', '{"token_online":null}',
    '{"token_online":"secret-token","appId":{}}',
    'token_online=secret-token%26other', 'token_online=secret-token%23other',
    'token_online=secret-token%0Aother', 'token_online=secret-token&appId=secret-app%23other',
    'token_online=first&token_online=second',
]) {
    test(`ignores unusable body ${JSON.stringify(body)}`, () => {
        const result = capture(body, 'saved-token#saved-app');
        assert.equal(result.value, 'saved-token#saved-app');
        assert.equal(result.writes, 0);
    });
}

for (const options of [
    { manual: true },
    { method: 'OPTIONS' },
    { url: 'https://example.com/mobileService/onLine.htm' },
    { url: 'https://m.client.10010.com.example.com/mobileService/onLine.htm' },
    { url: `${endpoint}extra` },
]) {
    test(`ignores unrelated invocation ${JSON.stringify(options)}`, () => {
        assert.equal(capture('token_online=secret-token', '', options).writes, 0);
    });
}

test('matches the endpoint with a query string', () => {
    assert.equal(capture('token_online=secret-token', '', { url: `${endpoint}?version=1` }).value, 'secret-token');
});

test('reports storage failure without exposing credentials', () => {
    const result = capture('token_online=secret-token&appId=secret-app', '', { writeFails: true });
    assert.equal(result.value, '');
    assert.equal(result.notifications.length, 1);
});

test('storage exceptions still finish without leaking the error message', () => {
    assert.equal(capture('token_online=secret-token', '', { throwOnRead: true }).writes, 0);
});

test('BoxJS exposes the same local key without a scheduled task', () => {
    const subscription = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../boxjs/DaiDaiPanel.boxjs.json'), 'utf8'));
    assert.equal(new Set(subscription.apps.map(app => app.id)).size, subscription.apps.length);
    const app = subscription.apps.find(entry => entry.id === 'mycookiecenter.chinaunicom');
    assert.ok(app, 'Unicom must be registered in BoxJS');
    assert.deepEqual(app.keys, [storageKey]);
    const setting = app.settings.find(entry => entry.id === storageKey);
    assert.equal(setting.type, 'textarea');
    assert.equal(setting.val, '');
    assert.equal((app.tasks || []).length, 0);
    assert.equal((app.scripts || []).length, 0);
});

test('Surge module scopes MITM and invokes the capture script with a body', () => {
    const modulePath = path.join(__dirname, '../../../surge/UnicomCookie.sgmodule');
    assert.ok(fs.existsSync(modulePath), 'Surge module must exist');
    const moduleText = fs.readFileSync(modulePath, 'utf8');
    const line = moduleText.split(/\r?\n/).find(entry => entry.startsWith('UnicomCookie = '));
    assert.ok(line);
    const parameters = Object.fromEntries(line.slice(line.indexOf('=') + 1).split(',').map(entry => {
        const separator = entry.indexOf('=');
        return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
    }));
    assert.equal(parameters.type, 'http-request');
    assert.equal(parameters['requires-body'], 'true');
    // 与 surge/CookieCenter.sgmodule 一致：脚本从 fork 的 surge 分支加载，?v= 为内容哈希（SHA-256 前 8 位，CRLF 归一为 LF）
    const contentHash = require('node:crypto').createHash('sha256')
        .update(Buffer.from(source.replace(/\r\n/g, '\n'), 'utf8')).digest('hex').slice(0, 8);
    assert.equal(parameters['script-path'], `https://raw.githubusercontent.com/shulkx/MyCookieCenter/surge/scripts/tools/unicom/unicom.cookie.js?v=${contentHash}`);
    const pattern = new RegExp(parameters.pattern);
    assert.ok(pattern.test(endpoint));
    assert.ok(pattern.test(`${endpoint}?version=1`));
    assert.ok(!pattern.test(`${endpoint}extra`));
    assert.ok(!pattern.test('https://example.com/mobileService/onLine.htm'));
    assert.match(moduleText, /^hostname = %APPEND% m\.client\.10010\.com$/m);
    assert.ok(!moduleText.includes('skip-server-cert-verify'));
});