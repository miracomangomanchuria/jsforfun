/*

https://dld.qzapp.z.qq.com/qpet/cgi-bin/phonepk?cmd=index&channel=0

*/
const $ = new API("");

!(async () => {
    if ($.env.isNode) {
        console.log('仅限iOS设备抓包用!');
    }
    else {
        console.log("===========qcdld_Cookie命中重写===============")
        let url  = $request.url;
        let headers = $request.headers;
        let cookies = headers['Cookie']

        let url_host = 'dld.qzapp.z.qq.com';
        let marker1 = 'qpet';
        let marker2 = 'cgi-bin';
        console.log("===========url===============")
        console.log(url)
        console.log("===========url_host位置===============")
        console.log(url.indexOf(url_host))
        console.log("===========标志物1位置===============")
        console.log(url.indexOf(marker1))
        console.log("===========标志物2位置===============")
        console.log(url.indexOf(marker2))

        if (((url.indexOf(url_host) > -1) && (url.indexOf(marker1) > -1)) && (url.indexOf(marker2) > -1)) {
            let tk = '';
            let rk = '';
            let ptcz = '';
            let skey = '';
            let uin = '';

            console.log(JSON.stringify(headers));
            let old_tk = $.read("#qcdld_Cookie")
            console.log("===========旧qcdld_Cookie的详情===============")
            console.log(old_tk)
            console.log("===========!old_tk的详情===============")
            console.log(!old_tk)
            console.log("===========!old_tk的详情在上边===============")

            if (!old_tk){

                console.log("===========old_tk上循环===============")
                rk = cookies.match(/RK=([^;]+)/)[1];
                ptcz = cookies.match(/ptcz=([^;]+)/)[1];
                skey = cookies.match(/skey=([^;]+)/)[1];
                uin = cookies.match(/uin=([^;]+)/)[1];
            } else {

                console.log("===========old_tk下循环===============")
                let rk_s = cookies.match(/RK=([^;]+)/);
                let ptcz_s = cookies.match(/ptcz=([^;]+)/);
                let skey_s = cookies.match(/skey=([^;]+)/);
                let uin_s = cookies.match(/uin=([^;]+)/);

                console.log(rk_s)

                if (rk_s) {

                    console.log("===========rk上循环===============")
                    rk = rk_s[1];
                    ptcz = ptcz_s[1];
                    skey = skey_s[1];
                    uin = uin_s[1];
                }else{

                    console.log("===========rk下循环===============")
                    let old_rk = old_tk.match(/RK=([^;]+)/)[1];
                    let old_ptcz = old_tk.match(/ptcz=([^;]+)/)[1];
                    rk = old_rk;
                    ptcz = old_ptcz;
                    skey = skey_s[1];
                    uin = uin_s[1];
                }
            }
        
            console.log("===========这是tk===============")
            tk = `RK=${rk}; ptcz=${ptcz}; uin=${uin}; skey=${skey}`;
            console.log(tk)

            console.log("===========当前qcdld_Cookie的详情===============")
            console.log(tk)
            console.log(old_tk !== tk)
            console.log(!(old_tk === tk))
            if (old_tk !== tk) {
            $.write(tk, '#qcdld_Cookie');
            $.notify('qcdld_Cookie 更新成功!', '', tk);
            }
        }
    }

})().catch((e) => {
    console.log('', `❌失败! 原因: ${e}!`, '');
}).finally(() => {
    $.done({});
})

/*********************************** API *************************************/
function ENV() { const e = "undefined" != typeof $task, t = "undefined" != typeof $loon, s = "undefined" != typeof $httpClient && !t, i = "function" == typeof require && "undefined" != typeof $jsbox; return { isQX: e, isLoon: t, isSurge: s, isNode: "function" == typeof require && !i, isJSBox: i, isRequest: "undefined" != typeof $request, isScriptable: "undefined" != typeof importModule } } function HTTP(e = { baseURL: "" }) { const { isQX: t, isLoon: s, isSurge: i, isScriptable: n, isNode: o } = ENV(), r = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/; const u = {}; return ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"].forEach(l => u[l.toLowerCase()] = (u => (function (u, l) { l = "string" == typeof l ? { url: l } : l; const h = e.baseURL; h && !r.test(l.url || "") && (l.url = h ? h + l.url : l.url); const a = (l = { ...e, ...l }).timeout, c = { onRequest: () => { }, onResponse: e => e, onTimeout: () => { }, ...l.events }; let f, d; if (c.onRequest(u, l), t) f = $task.fetch({ method: u, ...l }); else if (s || i || o) f = new Promise((e, t) => { (o ? require("request") : $httpClient)[u.toLowerCase()](l, (s, i, n) => { s ? t(s) : e({ statusCode: i.status || i.statusCode, headers: i.headers, body: n }) }) }); else if (n) { const e = new Request(l.url); e.method = u, e.headers = l.headers, e.body = l.body, f = new Promise((t, s) => { e.loadString().then(s => { t({ statusCode: e.response.statusCode, headers: e.response.headers, body: s }) }).catch(e => s(e)) }) } const p = a ? new Promise((e, t) => { d = setTimeout(() => (c.onTimeout(), t(`${u} URL: ${l.url} exceeds the timeout ${a} ms`)), a) }) : null; return (p ? Promise.race([p, f]).then(e => (clearTimeout(d), e)) : f).then(e => c.onResponse(e)) })(l, u))), u } function API(e = "untitled", t = !1) { const { isQX: s, isLoon: i, isSurge: n, isNode: o, isJSBox: r, isScriptable: u } = ENV(); return new class { constructor(e, t) { this.name = e, this.debug = t, this.http = HTTP(), this.env = ENV(), this.node = (() => { if (o) { return { fs: require("fs") } } return null })(), this.initCache(); Promise.prototype.delay = function (e) { return this.then(function (t) { return ((e, t) => new Promise(function (s) { setTimeout(s.bind(null, t), e) }))(e, t) }) } } initCache() { if (s && (this.cache = JSON.parse($prefs.valueForKey(this.name) || "{}")), (i || n) && (this.cache = JSON.parse($persistentStore.read(this.name) || "{}")), o) { let e = "root.json"; this.node.fs.existsSync(e) || this.node.fs.writeFileSync(e, JSON.stringify({}), { flag: "wx" }, e => console.log(e)), this.root = {}, e = `${this.name}.json`, this.node.fs.existsSync(e) ? this.cache = JSON.parse(this.node.fs.readFileSync(`${this.name}.json`)) : (this.node.fs.writeFileSync(e, JSON.stringify({}), { flag: "wx" }, e => console.log(e)), this.cache = {}) } } persistCache() { const e = JSON.stringify(this.cache, null, 2); s && $prefs.setValueForKey(e, this.name), (i || n) && $persistentStore.write(e, this.name), o && (this.node.fs.writeFileSync(`${this.name}.json`, e, { flag: "w" }, e => console.log(e)), this.node.fs.writeFileSync("root.json", JSON.stringify(this.root, null, 2), { flag: "w" }, e => console.log(e))) } write(e, t) { if (this.log(`SET ${t}`), -1 !== t.indexOf("#")) { if (t = t.substr(1), n || i) return $persistentStore.write(e, t); if (s) return $prefs.setValueForKey(e, t); o && (this.root[t] = e) } else this.cache[t] = e; this.persistCache() } read(e) { return this.log(`READ ${e}`), -1 === e.indexOf("#") ? this.cache[e] : (e = e.substr(1), n || i ? $persistentStore.read(e) : s ? $prefs.valueForKey(e) : o ? this.root[e] : void 0) } delete(e) { if (this.log(`DELETE ${e}`), -1 !== e.indexOf("#")) { if (e = e.substr(1), n || i) return $persistentStore.write(null, e); if (s) return $prefs.removeValueForKey(e); o && delete this.root[e] } else delete this.cache[e]; this.persistCache() } notify(e, t = "", l = "", h = {}) { const a = h["open-url"], c = h["media-url"]; if (s && $notify(e, t, l, h), n && $notification.post(e, t, l + `${c ? "\n多媒体:" + c : ""}`, { url: a }), i) { let s = {}; a && (s.openUrl = a), c && (s.mediaUrl = c), "{}" === JSON.stringify(s) ? $notification.post(e, t, l) : $notification.post(e, t, l, s) } if (o || u) { const s = l + (a ? `\n点击跳转: ${a}` : "") + (c ? `\n多媒体: ${c}` : ""); if (r) { require("push").schedule({ title: e, body: (t ? t + "\n" : "") + s }) } else console.log(`${e}\n${t}\n${s}\n\n`) } } log(e) { this.debug && console.log(`[${this.name}] LOG: ${this.stringify(e)}`) } info(e) { console.log(`[${this.name}] INFO: ${this.stringify(e)}`) } error(e) { console.log(`[${this.name}] ERROR: ${this.stringify(e)}`) } wait(e) { return new Promise(t => setTimeout(t, e)) } done(e = {}) { console.log('done!'); s || i || n ? $done(e) : o && !r && "undefined" != typeof $context && ($context.headers = e.headers, $context.statusCode = e.statusCode, $context.body = e.body) } stringify(e) { if ("string" == typeof e || e instanceof String) return e; try { return JSON.stringify(e, null, 2) } catch (e) { return "[object Object]" } } }(e, t) }
/*****************************************************************************/
