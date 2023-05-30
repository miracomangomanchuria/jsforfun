[rewrite_local]
^https?://mp\.weixin\.qq\.com/s.+? url response-body </script> response-body 'let scrollInterval = setInterval(() => {window.scrollBy(0, window.innerHeight);}, 3000); setTimeout(() => { clearInterval(scrollInterval); window.history.back();  }, 11000);' </script>

[mitm]
hostname = mp.weixin.qq.com
