/*
本脚本仅供个人学习交流使用，严禁用于任何商业用途，请于下载后24小时内删除。
脚本无意侵犯任何第三方的肖像权、名誉权、著作权、商标权等合法权益，如涉嫌侵权，请权利人联系脚本，脚本将在收到通知后24小时内删除相关内容。
QQ 农场 WAP Cookie 获取脚本

【抓包方式】
[rewrite_local]
^https?://mcapp\.z\.qq\.com/(?:nc|mc)/cgi-bin/wap_(?:farm_index|pasture_index|farm_fish_index).* url script-request-header qfarm_ck.js
^https://nc\.qzone\.qq\.com/cgi-bin/cgi_farm_index(?:\?.*)?$ url script-request-body qfarm_ck.js
[mitm]
hostname = mcapp.z.qq.com, nc.qzone.qq.com

【保存内容】
- qfarm_Cookie：openid、token（认证最小字段）
- qfarm_Profile：当前客户端实际请求中的非敏感协议配置

说明：
- WAP 农场首页和端游 JSON 首页均已验证只需 openid + token。
- 本脚本只保存 qfarm_Cookie，不读取或覆盖 qcdld_Cookie。
- 控制台和通知只显示字段名，不显示 Cookie/Token 值。
*/

const VERSION = "2026-07-12.v2";
const STORE_KEY = "qfarm_Cookie";
const PROFILE_STORE_KEY = "qfarm_Profile";
const NOTIFY = true;
const $ = new API(STORE_KEY);
const CAPTURE_CONFIG_TEXT = String.raw`[rewrite_local]
^https?://mcapp\.z\.qq\.com/(?:nc|mc)/cgi-bin/wap_(?:farm_index|pasture_index|farm_fish_index).* url script-request-header qfarm_ck.js
^https://nc\.qzone\.qq\.com/cgi-bin/cgi_farm_index(?:\?.*)?$ url script-request-body qfarm_ck.js
[mitm]
hostname = mcapp.z.qq.com, nc.qzone.qq.com`;

!(async () => {
  if ($.env.isNode) {
    console.log("仅限 iOS 设备抓包使用");
    return;
  }
  if (!$.env.isRequest) {
    console.log("仅用于重写脚本");
    console.log("QX 抓包配置（可整段复制）:\n" + CAPTURE_CONFIG_TEXT);
    return;
  }

  const headers = $request.headers || {};
  const cookie = headers.Cookie || headers.cookie || "";
  if (!cookie) {
    console.log("qfarm_Cookie 未捕获到 Cookie，请确认已打开农场 WAP 页面");
    return;
  }

  const old = $.read(STORE_KEY) || "";
  const oldMap = parseCookieMap(old);
  const data = {
    openid: matchCookie(cookie, "openid") || oldMap.openid || "",
    token: matchCookie(cookie, "token") || oldMap.token || ""
  };
  const missing = ["openid", "token"].filter((key) => !data[key]);
  if (missing.length) {
    console.log("qfarm_Cookie 字段不完整，缺少: " + missing.join(", "));
    return;
  }

  const value = "openid=" + data.openid + "; token=" + data.token;
  if (old === value) {
    console.log("qfarm_Cookie 未变化，字段: openid, token");
  } else {
    $.write(value, STORE_KEY);
    console.log("qfarm_Cookie 更新成功，字段: openid, token");
    if (NOTIFY) $.notify("QQ 农场会话更新成功", "", "已保存字段: openid, token");
  }

  const profile = buildProfile(headers, ($request && $request.body) || "");
  if (Object.keys(profile).length) {
    const profileText = JSON.stringify(profile);
    if ($.read(PROFILE_STORE_KEY) !== profileText) {
      $.write(profileText, PROFILE_STORE_KEY);
      console.log("qfarm_Profile 已更新，字段: " + Object.keys(profile).join(", "));
    }
  }
})()
  .catch((e) => {
    console.log("qfarm_Cookie 抓取失败: " + (e && e.message ? e.message : "unknown"));
  })
  .finally(() => {
    $.done({});
  });

function matchCookie(str, key) {
  const re = new RegExp("(?:^|;\\s*)" + key + "=([^;]+)");
  const m = String(str || "").match(re);
  return m ? m[1].trim() : "";
}

function parseCookieMap(cookie) {
  const map = Object.create(null);
  for (const part of String(cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    map[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return map;
}

function parseFormBody(body) {
  const map = Object.create(null);
  for (const part of String(body || "").split("&")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    let key = part.slice(0, i);
    let value = part.slice(i + 1);
    try {
      key = decodeURIComponent(key.replace(/\+/g, " "));
      value = decodeURIComponent(value.replace(/\+/g, " "));
    } catch (_) {}
    map[key] = value;
  }
  return map;
}

function buildProfile(headers, body) {
  const form = parseFormBody(body);
  const profile = {};
  const userAgent = headers["User-Agent"] || headers["user-agent"] || "";
  const unityVersion = headers["X-Unity-Version"] || headers["x-unity-version"] || "";
  if (/^qqfarm\/\d+\s+CFNetwork\//.test(userAgent) && userAgent.length <= 180) profile.userAgent = userAgent;
  if (/^[\w.\-]{3,80}$/.test(unityVersion)) profile.unityVersion = unityVersion;
  if (/^\d{1,3}$/.test(String(form.platform || ""))) profile.platform = String(form.platform);
  if (/^\d{1,8}$/.test(String(form.appid || ""))) profile.appid = String(form.appid);
  if (/^\d+(?:\.\d+){1,5}$/.test(String(form.version || ""))) profile.version = String(form.version);
  if (/^\d{1,3}$/.test(String(form.v_client || ""))) profile.v_client = String(form.v_client);
  return profile;
}

function ENV() {
  const isQX = typeof $task !== "undefined";
  const isLoon = typeof $loon !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && !isLoon;
  const isNode = typeof require === "function" && typeof $task === "undefined";
  return {
    isQX,
    isLoon,
    isSurge,
    isNode,
    isRequest: typeof $request !== "undefined"
  };
}

function API(name) {
  const env = ENV();
  return {
    env,
    read: (key) => {
      if (env.isQX) return $prefs.valueForKey(key);
      if (env.isSurge || env.isLoon) return $persistentStore.read(key);
      return null;
    },
    write: (value, key) => {
      if (env.isQX) return $prefs.setValueForKey(value, key);
      if (env.isSurge || env.isLoon) return $persistentStore.write(value, key);
      return false;
    },
    notify: (title, subtitle, body) => {
      if (env.isQX) $notify(title, subtitle || "", body || "");
      else if (env.isSurge || env.isLoon) $notification.post(title, subtitle || "", body || "");
    },
    done: (value) => {
      if (env.isQX || env.isSurge || env.isLoon) $done(value);
    }
  };
}
