/**
 * 中国联通 · Surge 本地凭据抓取
 * 打开已登录的联通 App，凭据变化时保存到 BoxJS 的 chinaUnicomCookie。
 * 安装与使用步骤见同目录 README.md。
 * @Updated: 2026-09-23
 */

(function main() {
    const storageKey = 'chinaUnicomCookie';
    const endpoint = /^https:\/\/m\.client\.10010\.com\/mobileService\/onLine\.htm(?:\?|$)/;

    try {
        if (typeof $request === 'undefined' || !$request || $request.method !== 'POST') return;
        if (!endpoint.test($request.url || '') || typeof $request.body !== 'string') return;

        const fields = parseBody($request.body);
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