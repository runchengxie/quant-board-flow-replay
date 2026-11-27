# 开发验证

[English](development.md)

使用独立任务worktree及源码外的专属环境/缓存。执行`uv sync --locked --group dev`、
`npm ci --ignore-scripts`后运行`bash scripts/check-quality.sh`，包含全部Python测试、Ruff格式与lint、
ty、全部Node测试及Python/npm依赖审计。TMPDIR放在项目源码之外，不能用排除规则隐藏失败。

浏览器验收先用合成数据构建：
`uv run python scripts/make-fixture.py --archive "$SYNTHETIC_ARCHIVE" --out "$REPLAY_OUTPUT"`。
然后执行`npm run test:browser -- --bundle "$REPLAY_OUTPUT" --out "$BROWSER_RESULTS"`。
安装与锁定playwright-core匹配的浏览器，或用PLAYWRIGHT_EXECUTABLE_PATH显式选择本机Chrome。
脚本保持Chromium沙箱启用，使用一次性profile并拦截外部页面请求。Unix使用较短的专属TMPDIR，
避免浏览器socket路径超长。截图/结果不入Git。公开CI运行合成测试、静态与依赖检查，浏览器验收单独记录。

可选`--expected`接收按日/分类/窗口的独立SQL排名JSON，这是本地任务证据，不提交真实数据。
覆盖非法输入、曲线与纵轴未来不变量、午休/缺口、缺名单、异步切日、语言保存和手机布局。
任何测试都不请求真实行情。
