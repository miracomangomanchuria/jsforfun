/*
【抓包方式】
1) 在 QX 添加重写（建议同时覆盖 dld + mcapp）：
   ^https?:\/\/(dld\.qzapp\.z\.qq\.com|mcapp\.z\.qq\.com)\/.* ^GET url-and-header script-request-header qcdld_ck.js
2) 打开大乐斗简版页面 -> 点击“QQ农场牧场版” -> 继续访问触屏版。
   当进入牧场主页后，再触发一次请求（例如刷新），即可写入完整字段。

【MITM】
在 QX 的 MITM 中添加：dld.qzapp.z.qq.com

【保存字段】
ptcz、openId、accessToken、newuin、openid、token

说明：
- 牧场直连更依赖 openid + token

存储键：#qcdld_Cookie
*/

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
    $.notify("qcdld_Cookie", "未捕获到 Cookie", "请确认已开启抓包");
    return;
  }

  const KEYS = ["ptcz", "openId", "accessToken", "newuin", "openid", "token"];
  const data = {};
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    const v = matchCookie(cookie, k);
    if (v) data[k] = v;
  }

  const old = $.read("#qcdld_Cookie") || "";
  const oldMap = parseCookieMap(old);
  // 如果本次缺字段，尝试用旧值补齐，避免覆盖成不完整 Cookie
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    if (!data[k] && oldMap[k]) data[k] = oldMap[k];
  }

  const parts = [];
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    if (data[k]) parts.push(k + "=" + data[k]);
  }
  if (!parts.length) {
    $.notify("qcdld_Cookie", "未解析到字段", "请确认抓包命中大乐斗请求");
    return;
  }
  if (!data.openid || !data.token) {
    $.notify(
      "qcdld_Cookie",
      "字段不完整",
      "缺少 openid/token，未覆盖旧 Cookie"
    );
    return;
  }
  const value = parts.join("; ");

  if (old !== value) {
    $.write(value, "#qcdld_Cookie");
    $.notify("qcdld_Cookie 更新成功", "", value);
  } else {
    console.log("qcdld_Cookie 未变化");
  }
})()
  .catch((e) => {
    console.log("❌ 抓取失败: " + e);
  })
  .finally(() => {
    $.done({});
  });

function matchCookie(str, key) {
  const re = new RegExp("(?:^|;\\s*)" + key + "=([^;]+)", "i");
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
