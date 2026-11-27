(function (root) {
  "use strict";
  const catalogs = {
    en: {
      "app.title": "Board flow replay", "app.kicker": "A-SHARE · LOCAL ARCHIVE",
      "app.subtitle": "Explore archived sector flows with an explicit historical cursor.",
      "notice.pit": "Post-close archive: hiding later points does not establish which values were available at that historical time. This is not a point-in-time signal backtest.",
      "notice.overlap": "Sector constituents overlap. Adding sector flows does not give total market flow. Main net flow follows the provider’s estimation method.",
      "control.language": "Language", "control.day": "Trading day", "control.type": "Sector type",
      "control.window": "Lookback", "control.cursor": "Replay time", "control.mode": "View",
      "control.board": "Find a sector", "control.searchPlaceholder": "Sector code or historical name",
      "type.concept": "Concept", "type.industry": "Industry", "type.region": "Region",
      "mode.asof": "Up to cursor", "mode.overview": "Full-day overview",
      "mode.asofHint": "Later values are hidden. The vertical scale uses only points up to the cursor.",
      "mode.overviewHint": "Full-day overview reveals values after the cursor. Use it only for retrospective exploration.",
      "section.ranking": "Change in main net flow", "section.curve": "Selected sector", "section.provenance": "Archive provenance",
      "table.board": "Sector", "table.delta": "Change (CNY 100m)",
      "unit.minutes": "{count} minutes", "unit.money": "CNY 100m",
      "status.loading": "Loading local archive for {date}…",
      "status.failed": "Could not load {date}. Keep the generated data files beside index.html.",
      "status.coverage": "{date} · Whole-day archived points: {observed} / {expected}",
      "status.coverageUnknown": "{date} · {observed} archived points; full-day coverage is unknown.",
      "status.scope": "{start}–{end} · {count} sectors with complete windows · Signed change, descending",
      "status.noWindow": "This lookback needs a complete window within one trading session.",
      "status.emptyRanking": "No complete windows are available at this time. Missing values are never treated as zero.",
      "status.noBoard": "No sector available", "status.notFound": "No matching sector in this category. Choose a listed code or name.",
      "status.point": "{time} · Cumulative {value} {unit}", "status.missingPoint": "{time} · Missing sample",
      "status.noCurve": "No visible samples at this cursor.",
      "warning.noCatalog": "The day’s sector catalog is missing. Historical names and the expected universe are unknown; sector codes are shown instead.",
      "warning.lateCatalog": "The day’s catalog was captured after the cursor ({captured}). Historical names and sample availability at that time are unverified.",
      "warning.gaps": "The visible curve contains missing samples. Gaps are shown, not filled; incomplete ranking windows are excluded.",
      "warning.partial": "The archive has missing minute points relative to its day catalog.",
      "warning.archive": "The archive declares additional quality warnings. Check the source archive before using it for research.",
      "provenance.date": "Trading day", "provenance.snapshot": "Archive snapshot", "provenance.source": "Source identifiers",
      "provenance.archived": "Minute records archived", "provenance.catalog": "Day catalog captured",
      "provenance.manifest": "Archive manifest SHA-256", "provenance.format": "Archive format",
      "provenance.timezone": "All trading times: Asia/Shanghai", "value.unknown": "Unknown",
      "footer.offline": "This page reads local generated files only. It does not request quotes, update the archive, or write to the source database.",
      "chart.label": "Cumulative main net flow; missing samples and lunch breaks are not joined."
    },
    "zh-CN": {
      "app.title": "板块资金流回放", "app.kicker": "A 股 · 本地归档",
      "app.subtitle": "选择历史时点，查看已归档的板块资金流。",
      "notice.pit": "这是盘后归档。隐藏游标之后的数据，并不证明这些数值在当时已经可获取，不能据此做严格的时点信号回测。",
      "notice.overlap": "板块成分有重叠，不能把各板块净流入相加当成全市场资金流。“主力净流入”沿用供应商的估算口径。",
      "control.language": "语言", "control.day": "交易日", "control.type": "板块类型",
      "control.window": "回看窗口", "control.cursor": "回放时点", "control.mode": "查看方式",
      "control.board": "查找板块", "control.searchPlaceholder": "板块代码或当日名称",
      "type.concept": "概念", "type.industry": "行业", "type.region": "地域",
      "mode.asof": "仅看到游标", "mode.overview": "全天总览",
      "mode.asofHint": "隐藏之后的数值，纵轴也只根据游标之前的数据计算。",
      "mode.overviewHint": "全天总览会显示游标之后的数值，只适合事后浏览。",
      "section.ranking": "主力净流入增量", "section.curve": "选中板块", "section.provenance": "归档来源",
      "table.board": "板块", "table.delta": "增量（亿元）",
      "unit.minutes": "{count} 分钟", "unit.money": "亿元",
      "status.loading": "正在读取 {date} 的本地归档…",
      "status.failed": "未能读取 {date}，请保留 index.html 同目录下的生成数据文件。",
      "status.coverage": "{date} · 全天归档分钟点：{observed} / {expected}",
      "status.coverageUnknown": "{date} · 已归档 {observed} 个分钟点，全天覆盖率未知。",
      "status.scope": "{start}–{end} · {count} 个板块窗口完整 · 按有符号增量降序",
      "status.noWindow": "该窗口需要同一交易时段内的完整数据。",
      "status.emptyRanking": "这个时点没有完整的比较窗口，缺失值不会当成零。",
      "status.noBoard": "没有可用板块", "status.notFound": "这个分类下没有匹配板块，请从列表中选择代码或名称。",
      "status.point": "{time} · 累计 {value} {unit}", "status.missingPoint": "{time} · 数据缺失",
      "status.noCurve": "游标之前没有可显示的数据。",
      "warning.noCatalog": "缺少当天的板块名单，历史名称和应有板块范围均未知，页面只显示代码。",
      "warning.lateCatalog": "当天名单采集于 {captured}，晚于当前游标，历史名称及样本在该时点是否可获取尚未验证。",
      "warning.gaps": "当前曲线有缺失点，页面保留断档，不作填补；排名也会排除不完整的窗口。",
      "warning.partial": "相对于当天板块名单，归档中有分钟点缺失。",
      "warning.archive": "归档记录了其他质量提示，用于研究前请检查源归档。",
      "provenance.date": "交易日", "provenance.snapshot": "归档快照时间", "provenance.source": "数据源标识",
      "provenance.archived": "分钟记录归档时间", "provenance.catalog": "当日名单采集时间",
      "provenance.manifest": "归档清单 SHA-256", "provenance.format": "归档格式",
      "provenance.timezone": "交易时间统一为 Asia/Shanghai", "value.unknown": "未知",
      "footer.offline": "页面只读取本地生成文件，不请求行情、不更新归档，也不写入原数据库。",
      "chart.label": "累计主力净流入曲线，缺失点和午休之间不连线。"
    }
  };
  const storageKey = "board-flow-replay.language";
  const normalize = locale => Object.prototype.hasOwnProperty.call(catalogs, locale) ? locale : "en";
  function chooseLocale(storage) {
    try { return normalize(storage && storage.getItem(storageKey)); } catch (_) { return "en"; }
  }
  function saveLocale(storage, locale) {
    const selected = normalize(locale);
    try { if (storage) storage.setItem(storageKey, selected); } catch (_) { /* Storage is optional. */ }
    return selected;
  }
  function message(locale, key, values) {
    const template = catalogs[normalize(locale)][key] || catalogs.en[key] || key;
    return template.replace(/\{(\w+)\}/g, (match, name) => values && values[name] !== undefined ? String(values[name]) : match);
  }
  function formatMoney(locale, value) {
    return new Intl.NumberFormat(normalize(locale), {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value / 1e8);
  }
  function formatCount(locale, value) {
    return new Intl.NumberFormat(normalize(locale)).format(value);
  }
  function formatTimestamp(locale, text) {
    if (!text) return message(locale, "value.unknown");
    let iso = String(text).replace(" ", "T");
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(iso)) iso += "+08:00";
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return String(text);
    return new Intl.DateTimeFormat(normalize(locale), {dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai"}).format(date);
  }
  root.ReplayI18n = Object.freeze({chooseLocale, saveLocale, message, formatMoney, formatCount, formatTimestamp});
})(window);
