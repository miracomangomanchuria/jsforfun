# a-Shell 运行说明（北京地铁脚本）

本文档对应启动器：
- `run_beijing_subway_py_ashell.sh`

你的 GitHub Raw 地址（已验证可访问）：
- `https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/refs/heads/main/beijing_subway/run_beijing_subway_py_ashell.sh`
- `https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/main/beijing_subway/run_beijing_subway_py_ashell.sh`

## 1. 你要控制的参数

命令里主要就这几个：

1. `LON`：经度（在前）
2. `LAT`：纬度（在后）
3. `FORCE_PULL`：是否强制更新 Python 主脚本  
`0` = 不强制（默认）  
`1` = 强制拉取最新
4. `AUTO_PULL_DAYS`：可选，按天自动更新（`0` 表示关闭）
5. `IP_GEO_FALLBACK`：未传 `LON/LAT` 时，是否启用 IP 粗定位（默认 `1`）
6. `AMAP_KEY`：可选，高德 Web Key，用于提升中国大陆 IP 定位可用性

## 2. a-Shell 兼容优先写法（推荐）

说明：
1. a-Shell 并非完整 Bash，最稳的是“位置参数”或“先 export 再执行”。
2. 避免把 `LON=... LAT=...` 或 `FORCE_PULL=...` 直接放在命令前（某些场景解析不稳定）。
3. 绝对不要写 `LON=<经度>`，`<` `>` 会被当成重定向符号。

### 2.1 先下载再执行（位置参数，最稳）

```sh
curl -fsSL "https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/main/beijing_subway/run_beijing_subway_py_ashell.sh" -o "$HOME/Documents/run_beijing_subway_py_ashell.sh"
chmod +x "$HOME/Documents/run_beijing_subway_py_ashell.sh"
```

平时运行（不强制更新）：

```sh
sh "$HOME/Documents/run_beijing_subway_py_ashell.sh" YOUR_LON YOUR_LAT
```

不传经纬度，走 IP 粗定位（默认开启）：

```sh
sh "$HOME/Documents/run_beijing_subway_py_ashell.sh"
```

不传经纬度 + 指定高德 Key（更稳）：

```sh
export AMAP_KEY=YOUR_AMAP_KEY
sh "$HOME/Documents/run_beijing_subway_py_ashell.sh"
```

强制更新后再运行：

```sh
export FORCE_PULL=1
sh "$HOME/Documents/run_beijing_subway_py_ashell.sh" YOUR_LON YOUR_LAT
```

每 7 天自动更新一次：

```sh
export AUTO_PULL_DAYS=7
sh "$HOME/Documents/run_beijing_subway_py_ashell.sh" YOUR_LON YOUR_LAT
```

### 2.2 export 方式（适合调试）

```sh
export LON=YOUR_LON
export LAT=YOUR_LAT
export FORCE_PULL=0
sh "$HOME/Documents/run_beijing_subway_py_ashell.sh"
```

## 3. 一行执行（带下载失败检测）

不落地文件，直接执行（位置参数，失败会报错）：

```sh
TMP_SH="$HOME/Documents/.run_beijing_subway_py_ashell.tmp.sh"; \
curl -fsSL "https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/refs/heads/main/beijing_subway/run_beijing_subway_py_ashell.sh" -o "$TMP_SH" && \
sh "$TMP_SH" YOUR_LON YOUR_LAT; \
RC=$?; rm -f "$TMP_SH"; \
[ "$RC" -eq 0 ]
```

强制更新版本：

```sh
export FORCE_PULL=1
TMP_SH="$HOME/Documents/.run_beijing_subway_py_ashell.tmp.sh"; \
curl -fsSL "https://raw.githubusercontent.com/miracomangomanchuria/jsforfun/refs/heads/main/beijing_subway/run_beijing_subway_py_ashell.sh" -o "$TMP_SH" && \
sh "$TMP_SH" YOUR_LON YOUR_LAT; \
RC=$?; rm -f "$TMP_SH"; \
[ "$RC" -eq 0 ]
```

## 4. 位置参数写法（可选）

启动器也支持位置参数：

```sh
sh "$HOME/Documents/run_beijing_subway_py_ashell.sh" YOUR_LON YOUR_LAT
```

## 4.1 a-Shell 逐行调试（推荐）

如果你要排查参数问题，建议用 `export` 逐行执行：

```sh
export LON=YOUR_LON
export LAT=YOUR_LAT
export FORCE_PULL=0
sh "$HOME/Documents/run_beijing_subway_py_ashell.sh"
```

注意：
1. 不要写成 `LON=<经度>` 这种形式，`<` `>` 在 shell 里是重定向符号。
2. 正确写法是 `LON=YOUR_LON` / `LAT=YOUR_LAT` 这种纯文本值。

说明：
1. 位置参数会覆盖脚本里的默认 `LON/LAT`。
2. 你也可以同时加 `FORCE_PULL=1`。

## 5. 默认行为总结

1. 不会每次都主动拉取 Python。
2. 仅当本地缺少 Python 文件时自动拉取。
3. `FORCE_PULL=1` 时才强制更新。
4. 未传经纬度时，会先尝试 IP 粗定位（可通过 `IP_GEO_FALLBACK=0` 关闭）。
5. 如果本次定位来自 IP 粗定位，站点距离会显示为 `📏约xxx米`（表示粗略距离）。
