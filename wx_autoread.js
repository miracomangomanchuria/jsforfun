var body = $response.body
    .replace(/<\/script>/, 'let scrollInterval = setInterval(() => {  window.scrollBy(0, window.innerHeight);}, 3000); setTimeout(() => {clearInterval(scrollInterval); window.history.back(); }, 11000); </script>');
$done({ body });
