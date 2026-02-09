/*
大乐斗 Cookie 获取脚本（六字段）

【抓包方式】
1) 在 QX 添加重写：
   ^https?://dld\\.qzapp\\.z\\.qq\\.com/qpet/cgi-bin/phonepk\\?cmd=index.* ^GET url-and-header script-request-header qcdld_ck.js
2) 打开大乐斗简版页面，触发请求即可写入。

【MITM】
在 QX 的 MITM 中添加：dld.qzapp.z.qq.com

【保存字段】
ptcz、openId、accessToken、newuin、openid、token

说明：
- 牧场直连更依赖 openid + token
- openId 与 openid 必须区分（大小写不同，值可能不同）

存储键：qcdld_Cookie
*/

const VERSION = "2026-02-09.v3";
const DEBUG = false;
const $ = new API("qcdld_Cookie");

!(async () => {
  if ($.env.isNode) {
    console.log("仅限 iOS 设备抓包使用");
    return;
  }
  if (!$.env.isRequest) {
    console.log("仅用于重写脚本");
    return;
  }

  const headers = $request.headers || {};
  const cookie = headers["Cookie"] || headers["cookie"] || "";
  if (!cookie) {
    console.log("qcdld_Cookie 未捕获到 Cookie，请确认已开启抓包");
    return;
  }

  const KEYS = ["ptcz", "openId", "accessToken", "newuin", "openid", "token"];
  const data = {};
  const source = {};
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    const v = matchCookie(cookie, k);
    if (v) {
      data[k] = v;
      source[k] = "new";
    }
  }

  const old = $.read("qcdld_Cookie") || "";
  const oldMap = parseCookieMap(old);
  const capturedKeys = Object.keys(data)
    .filter((k) => data[k] && source[k] === "new")
    .join(", ");
  if (DEBUG) {
    console.log("qcdld_ck version=" + VERSION);
    console.log("old cookie=" + old);
    console.log("captured keys=" + capturedKeys);
  }
  // 如果本次缺字段，尝试用旧值补齐，避免覆盖成不完整 Cookie
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    if (!data[k] && oldMap[k]) {
      data[k] = oldMap[k];
      source[k] = "old";
    }
  }

  const parts = [];
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    if (data[k]) parts.push(k + "=" + data[k]);
  }
  if (!parts.length) {
    console.log("qcdld_Cookie 未解析到字段，请确认抓包命中大乐斗请求");
    return;
  }
  const missing = KEYS.filter((k) => !data[k]);
  const filled = KEYS.filter((k) => source[k] === "old");
  if (capturedKeys) console.log("已捕获字段: " + capturedKeys);
  if (filled.length) console.log("沿用旧值: " + filled.join(", "));
  if (missing.length) console.log("缺失字段: " + missing.join(", "));
  if (!data.openid || !data.token) {
    console.log("字段不完整(openid/token缺失)，未覆盖旧 Cookie");
    console.log("旧值: " + (old || "无"));
    return;
  }
  const value = parts.join("; ");

  if (old !== value) {
    $.write(value, "qcdld_Cookie");
    console.log("qcdld_Cookie 更新成功");
    console.log("旧值: " + (old || "无"));
    console.log("新值: " + value);
  } else {
    console.log("qcdld_Cookie 未变化");
    console.log("旧值: " + (old || "无"));
  }
})()
  .catch((e) => {
    console.log("❌ 抓取失败: " + e);
  })
  .finally(() => {
    $.done({});
  });

function matchCookie(str, key) {
  // 注意：区分 openId / openid，不能大小写不敏感匹配
  const re = new RegExp("(?:^|;\\s*)" + key + "=([^;]+)");
  const m = str.match(re);
  return m ? m[1] : "";
}

function parseCookieMap(cookie) {
  const map = {};
  if (!cookie) return map;
  const parts = cookie.split(";");
  for (let i = 0; i < parts.length; i++) {
    const kv = parts[i].trim();
    if (!kv || kv.indexOf("=") < 0) continue;
    const k = kv.split("=")[0].trim();
    const v = kv.slice(k.length + 1);
    if (k) map[k] = v;
  }
  return map;
}

/* ===== API ===== */
function ENV() {
  const isQX = typeof $task !== "undefined";
  const isLoon = typeof $loon !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && !isLoon;
  const isNode = typeof require === "function" && typeof $task === "undefined";
  return {
    isQX: isQX,
    isLoon: isLoon,
    isSurge: isSurge,
    isNode: isNode,
    isRequest: typeof $request !== "undefined"
  };
}

function API(name) {
  const env = ENV();
  return {
    env: env,
    read: (key) => {
      if (env.isQX) return $prefs.valueForKey(key);
      if (env.isSurge || env.isLoon) return $persistentStore.read(key);
      return null;
    },
    write: (val, key) => {
      if (env.isQX) return $prefs.setValueForKey(val, key);
      if (env.isSurge || env.isLoon) return $persistentStore.write(val, key);
      return false;
    },
    notify: (title, sub, body) => {
      if (env.isQX) $notify(title, sub || "", body || "");
      else if (env.isSurge || env.isLoon) $notification.post(title, sub || "", body || "");
      else console.log(title + " " + (sub || "") + "\n" + (body || ""));
    },
    done: (val) => {
      if (env.isQX || env.isSurge || env.isLoon) $done(val);
    }
  };
}
