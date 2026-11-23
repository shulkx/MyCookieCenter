const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, 'unicom.cookie.js');
const source = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';
const storageKey = 'chinaUnicomCookie';
// iOS 联通 App 13.2 起登录相关接口走 loginxx 域名，旧版走 m.client。
// login_vcode_member.htm 在冷启动和每次登录后发出，请求体带当前有效的 token_online 与 appId。
const memberRequests = [
    'https://loginxx.10010.com/mobileService/login_vcode_member.htm',
    'https://m.client.10010.com/mobileService/login_vcode_member.htm',
];
// onLine.htm 会轮换 token：请求体里是即将被换掉的旧值，新值只在响应里。
const onlineUrls = [
    'https://loginxx.10010.com/mobileService/onLine.htm',
    'https://m.client.10010.com/mobileService/onLine.htm',
];
const endpoint = memberRequests[0];
// 退出登录请求也带 token_online，但那是正在作废的旧 token，绝不能抓
const rejected = [
    'https://loginxx.10010.com/mobileService/logout.htm',
    'https://loginxx.10010.com/mobileService/login.htm',
    'https://loginxx.10010.com.example.com/mobileService/onLine.htm',
    'https://example.com/mobileService/login_vcode_member.htm',
    'https://loginxx.10010.com/mobileService/login_vcode_member.htmextra',
];

function capture(body, previous = '', options = {}) {
    const isResponse = options.response !== undefined;
    const request = options.manual ? undefined : {
        url: options.url || endpoint,
        method: options.method || 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: isResponse ? undefined : body,
    };
    const response = isResponse ? { status: 200, headers: { 'Content-Type': 'text/html' }, body: options.response } : undefined;
    const snapshot = JSON.stringify([request, response]);
    const result = { value: previous, writes: 0, notifications: [], logs: [], completed: [] };
    const context = {
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
    };
    if (isResponse) context.$response = response;
    vm.runInNewContext(source, context);
    assert.equal(result.completed.length, 1, '$done must run exactly once');
    assert.equal(JSON.stringify(result.completed[0]), '{}', 'request/response must pass through unchanged');
    assert.equal(JSON.stringify([request, response]), snapshot, 'request/response must not be mutated');
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
    ...rejected.map(url => ({ url })),
]) {
    test(`ignores unrelated invocation ${JSON.stringify(options)}`, () => {
        assert.equal(capture('token_online=secret-token', '', options).writes, 0);
    });
}

for (const url of memberRequests) {
    test(`captures request body of ${url}`, () => {
        const result = capture('version=iphone_c%4013.0200&token_online=secret-token&appId=secret-app', '', { url });
        assert.equal(result.value, 'secret-token#secret-app');
        assert.equal(result.notifications.length, 1);
    });
}

const onlineOk = JSON.stringify({ code: '0', token_online: 'secret-token', appId: 'secret-app', ecs_token: 'x', list: [] });
for (const url of onlineUrls) {
    test(`captures rotated token from response of ${url}`, () => {
        const result = capture(undefined, 'old-token#secret-app', { url, response: onlineOk });
        assert.equal(result.value, 'secret-token#secret-app');
        assert.equal(result.notifications.length, 1);
    });

    test(`ignores the outgoing (about-to-rotate) token in request of ${url}`, () => {
        const result = capture('token_online=old-token&appId=secret-app', 'saved-token#saved-app', { url });
        assert.equal(result.value, 'saved-token#saved-app');
        assert.equal(result.writes, 0);
    });

    for (const body of [
        JSON.stringify({ code: '1', dsc: '您的登录凭证已失效，请重新登录' }),
        JSON.stringify({ code: '2', token_online: 'secret-token', appId: 'secret-app' }),
        JSON.stringify({ token_online: 'secret-token', appId: 'secret-app' }),
        'not json',
    ]) {
        test(`ignores unsuccessful onLine response ${body} at ${url}`, () => {
            assert.equal(capture(undefined, 'saved-token#saved-app', { url, response: body }).writes, 0);
        });
    }
}

test('ignores responses of request-only endpoints', () => {
    assert.equal(capture(undefined, '', { url: memberRequests[0], response: onlineOk }).writes, 0);
});

test('numeric success code in onLine response is accepted', () => {
    const body = JSON.stringify({ code: 0, token_online: 'secret-token', appId: 'secret-app' });
    assert.equal(capture(undefined, '', { url: onlineUrls[0], response: body }).value, 'secret-token#secret-app');
});

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
    const parse = name => {
        const line = moduleText.split(/\r?\n/).find(entry => entry.startsWith(`${name} = `));
        assert.ok(line, `${name} script line must exist`);
        return Object.fromEntries(line.slice(line.indexOf('=') + 1).split(',').map(entry => {
            const separator = entry.indexOf('=');
            return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
        }));
    };
    // 与 surge/CookieCenter.sgmodule 一致：脚本从 fork 的 surge 分支加载，?v= 为内容哈希（SHA-256 前 8 位，CRLF 归一为 LF）
    const contentHash = require('node:crypto').createHash('sha256')
        .update(Buffer.from(source.replace(/\r\n/g, '\n'), 'utf8')).digest('hex').slice(0, 8);
    const scriptPath = `https://raw.githubusercontent.com/shulkx/MyCookieCenter/surge/scripts/tools/unicom/unicom.cookie.js?v=${contentHash}`;

    const member = parse('UnicomCookie');
    assert.equal(member.type, 'http-request');
    assert.equal(member['requires-body'], 'true');
    assert.equal(member['script-path'], scriptPath);
    const online = parse('UnicomCookieOnline');
    assert.equal(online.type, 'http-response');
    assert.equal(online['requires-body'], 'true');
    assert.equal(online['script-path'], scriptPath);

    const memberPattern = new RegExp(member.pattern);
    const onlinePattern = new RegExp(online.pattern);
    for (const [pattern, urls, others] of [[memberPattern, memberRequests, onlineUrls], [onlinePattern, onlineUrls, memberRequests]]) {
        for (const url of urls) {
            assert.ok(pattern.test(url), `module must match ${url}`);
            assert.ok(pattern.test(`${url}?version=1`));
            assert.ok(!pattern.test(`${url}extra`));
        }
        for (const url of [...others, ...rejected]) assert.ok(!pattern.test(url), `pattern must not match ${url}`);
    }
    assert.match(moduleText, /^hostname = %APPEND% m\.client\.10010\.com, loginxx\.10010\.com$/m);
    assert.ok(!moduleText.includes('skip-server-cert-verify'));
});