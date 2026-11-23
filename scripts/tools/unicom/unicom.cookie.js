/**
 * 中国联通 · Surge 本地凭据抓取
 * 打开已登录的联通 App，凭据变化时保存到 BoxJS 的 chinaUnicomCookie。
 * 安装与使用步骤见同目录 README.md。
 * @Updated: 2026-11-23
 */

(function main() {
    const storageKey = 'chinaUnicomCookie';
    // iOS App 13.2 起登录接口走 loginxx 域名，旧版走 m.client。不匹配 logout.htm：它携带的是正在作废的旧 token。
    // login_vcode_member.htm：冷启动和每次登录后发出，请求体带当前有效的 token_online 与 appId。
    const memberRequest = /^https:\/\/(?:m\.client|loginxx)\.10010\.com\/mobileService\/login_vcode_member\.htm(?:\?|$)/;
    // onLine.htm 会轮换 token：请求体里是即将被换掉的旧值，新值只在成功响应里。
    const onlineResponse = /^https:\/\/(?:m\.client|loginxx)\.10010\.com\/mobileService\/onLine\.htm(?:\?|$)/;

    try {
        if (typeof $request === 'undefined' || !$request) return;
        const url = $request.url || '';
        let fields;
        if (typeof $response !== 'undefined' && $response) {
            if (!onlineResponse.test(url) || typeof $response.body !== 'string') return;
            fields = parseBody($response.body);
            if (String(fields.code) !== '0') return;
        } else {
            if ($request.method !== 'POST' || !memberRequest.test(url) || typeof $request.body !== 'string') return;
            fields = parseBody($request.body);
        }

        const token = fields.token_online;
        const appId = fields.appId;
        if (!isCredential(token)) return;
        if (appId !== undefined && appId !== '' && !isCredential(appId)) return;

        const previous = $persistentStore.read(storageKey) || '';
        const saved = previous.split('#');
        if (!appId && saved.length === 2 && saved[0] === token && isCredential(saved[1])) return;
        const value = appId ? `${token}#${appId}` : token;
        if (value === previous) return;

        if (!$persistentStore.write(value, storageKey)) {
            $notification.post('中国联通凭据', '保存失败', '请检查 Surge 本地存储后重试。');
            return;
        }

        $notification.post(
            '中国联通凭据',
            '已保存到本机',
            appId
                ? '请在 BoxJS 的中国联通中复制 chinaUnicomCookie 到青龙；凭据有效性以青龙登录结果为准。'
                : '本次仅捕获 Token。可在 BoxJS 复制到青龙尝试登录；若失败，请重新打开联通 App 抓取。'
        );
    } catch (error) {
        console.log('[Unicom Capture] Capture skipped; check request format and local storage.');
    } finally {
        $done({});
    }
})();

function isCredential(value) {
    return typeof value === 'string' && /^[^\s&#]+$/.test(value);
}

function parseBody(body) {
    const text = body.trim();
    if (text.startsWith('{')) {
        return JSON.parse(text);
    }

    const fields = Object.create(null);
    for (const entry of text.split('&')) {
        const separator = entry.indexOf('=');
        if (separator < 0) continue;
        const key = decodeURIComponent(entry.slice(0, separator).replace(/\+/g, ' '));
        if (key !== 'token_online' && key !== 'appId') continue;
        if (Object.prototype.hasOwnProperty.call(fields, key)) {
            throw new Error('Duplicate credential field');
        }
        fields[key] = decodeURIComponent(entry.slice(separator + 1).replace(/\+/g, ' '));
    }
    return fields;
}