(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const model = window.ReplayModel, i18n = window.ReplayI18n, meta = window.REPLAY_META;
  const ui = Object.fromEntries(["day", "kind", "win", "minute", "lookup", "language", "mode"].map(id => [id, $(id)]));
  let storage = null;
  try { storage = window.localStorage; } catch (_) { /* Local files may deny storage. */ }
  let locale = i18n.chooseLocale(storage), payload = null, phase = "loading", lastSample = null;
  const selectedKey = "board-flow-replay.selected-codes";
  let selectedCodes = {};
  try {
    const saved = storage && JSON.parse(storage.getItem(selectedKey));
    if (saved && typeof saved === "object" && !Array.isArray(saved)) selectedCodes = saved;
  } catch (_) { /* A stored preference is optional. */ }
  const watchKey = "board-flow-replay.watchlist", compactKey = "board-flow-replay.compact";
  let pins = [], compact = false;
  try {
    pins = model.normalizePins(storage && JSON.parse(storage.getItem(watchKey)));
    compact = storage?.getItem(compactKey) === "true";
  } catch (_) { /* Preferences are optional. */ }
  function savePins() {
    try { if (storage) storage.setItem(watchKey, JSON.stringify(pins)); } catch (_) { /* Keep in memory. */ }
  }
  const t = (key, values) => i18n.message(locale, key, values);
  const count = value => i18n.formatCount(locale, value);
  const money = value => i18n.formatMoney(locale, value);
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function option(text, value) { const element = node("option", text); element.value = value; return element; }
  function svg(tag, attributes, text) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function persistSelection(type, code) {
    selectedCodes[type] = code;
    try { if (storage) storage.setItem(selectedKey, JSON.stringify(selectedCodes)); } catch (_) { /* Keep the in-memory choice. */ }
  }
  function displayName(board) {
    return board.name && board.name !== board.code ? `${board.name} · ${board.code}` : board.code;
  }
  function renderChart(board, cursor) {
    const chart = $("chart"); chart.replaceChildren();
    $("boardname").textContent = board ? displayName(board) : t("status.noBoard");
    $("value").textContent = board ? board.values[cursor] === null ? t("status.missingPoint", {time: meta.times[cursor]}) :
      t("status.point", {time: meta.times[cursor], value: money(board.values[cursor]), unit: t("unit.money")}) : "";
    if (!board) return;
    const data = model.chartModel(board, cursor, ui.mode.value);
    const x = index => 70 + index * 528 / (meta.times.length - 1);
    const y = value => 25 + (data.max - value) * 210 / (data.max - data.min || 1);
    for (const value of [...new Set([data.min, 0, data.max])]) {
      chart.append(svg("line", {x1: 70, x2: 598, y1: y(value), y2: y(value), stroke: value === 0 ? "#8c9e90" : "#dce3d8"}));
    }
    for (const label of model.axisLabels(data.min, data.max, 210, 16)) {
      chart.append(svg("text", {x: 63, y: 25 + label.position + 4, "text-anchor": "end", fill: "#52676a", "font-size": 11}, money(label.value)));
    }
    for (const index of [0, 119, 120, 239]) chart.append(svg("text", {x: x(index), y: index === 120 ? 273 : 257,
      "text-anchor": "middle", fill: "#52676a", "font-size": 11}, meta.times[index]));
    chart.append(svg("line", {x1: x(cursor), x2: x(cursor), y1: 23, y2: 237, stroke: "#997448", "stroke-dasharray": "4 4"}));
    const path = data.segments.map(segment => segment.map((point, index) =>
      `${index ? "L" : "M"}${x(point.index)} ${y(point.value)}`).join(" ")).join(" ");
    if (path) chart.append(svg("path", {d: path, stroke: "#176451", fill: "none", "stroke-width": 2}));
    else chart.append(svg("text", {x: 320, y: 120, "text-anchor": "middle", fill: "#52676a", "font-size": 13}, t("status.noCurve")));
    if (data.current) chart.append(svg("circle", {cx: x(data.current.index), cy: y(data.current.value), r: 4, fill: "#a43c35"}));
  }
  function renderProvenance() {
    const list = $("provenance"); list.replaceChildren();
    if (!payload) return;
    const provenance = payload.provenance || {}, archive = meta.archive || {};
    const range = (first, last) => !first ? t("value.unknown") : first === last || !last ? i18n.formatTimestamp(locale, first) :
      `${i18n.formatTimestamp(locale, first)} – ${i18n.formatTimestamp(locale, last)}`;
    const entries = [
      ["provenance.date", ui.day.value], ["provenance.snapshot", i18n.formatTimestamp(locale, archive.snapshotAt)],
      ["provenance.source", provenance.sources?.join(", ") || t("value.unknown")],
      ["provenance.archived", range(provenance.archivedAtMin, provenance.archivedAtMax)],
      ["provenance.catalog", range(provenance.catalogCapturedAtMin, provenance.catalogCapturedAtMax)],
      ["provenance.format", archive.format || t("value.unknown")], ["provenance.manifest", archive.manifestSha256 || t("value.unknown")]
    ];
    for (const [key, value] of entries) list.append(node("dt", t(key)), node("dd", value));
  }
  function renderWatchlist(cursor, selected) {
    const list = $("watchlist"); list.replaceChildren();
    $("export-observation").disabled = phase !== "ready" || pins.length === 0;
    const watched = selected && pins.some(pin => pin.type === selected.type && pin.code === selected.code);
    $("pin").disabled = !selected || watched || pins.length >= 12;
    $("pin").textContent = t(watched ? "watch.watched" : pins.length >= 12 ? "watch.full" : "watch.add");
    $("watch-empty").hidden = pins.length > 0;
    for (const row of model.watchRows(payload?.boards || [], pins, cursor, meta.times)) {
      const tr = node("tr"), identity = node("td");
      const button = node("button", row.board ? displayName(row.board) : row.code);
      button.type = "button"; button.disabled = !row.board;
      button.onclick = () => {
        ui.kind.value = row.type; persistSelection(row.type, row.code); listBoards(); render();
      };
      identity.append(button);
      if (!row.board) identity.append(node("span", t("watch.missing"), "hint"));
      tr.append(identity);
      for (const minutes of [5, 15, 30]) {
        const delta = row.deltas[minutes];
        tr.append(node("td", delta === null ? "—" : `${delta > 0 ? "+" : ""}${money(delta)}`,
          delta > 0 ? "positive" : delta < 0 ? "negative" : ""));
      }
      const action = node("td"), remove = node("button", t("watch.remove"));
      remove.type = "button";
      remove.setAttribute("aria-label", `${t("watch.remove")} ${row.code}`);
      remove.onclick = () => { pins = pins.filter(pin => pin.code !== row.code || pin.type !== row.type); savePins(); render(); };
      action.append(remove); tr.append(action); list.append(tr);
    }
  }
  function renderRanking(id, rows, selected) {
    for (const row of rows.slice(0, 12)) {
      const tr = node("tr"), td = node("td"), button = node("button", displayName(row.board));
      button.type = "button"; button.dataset.code = row.board.code;
      button.setAttribute("aria-pressed", String(selected?.code === row.board.code));
      button.onclick = () => { persistSelection(row.board.type, row.board.code); render(); };
      td.append(button); tr.append(td, node("td", `${row.delta > 0 ? "+" : ""}${money(row.delta)}`, row.delta > 0 ? "positive" : row.delta < 0 ? "negative" : ""));
      $(id).append(tr);
    }
  }
  function render() {
    const cursor = Number(ui.minute.value), minutes = Number(ui.win.value), type = ui.kind.value;
    document.documentElement.className = compact ? "widget" : "";
    $("compact").setAttribute("aria-pressed", String(compact));
    $("archive-state").textContent = t("widget.archive", {date: [...meta.dates].sort().at(-1) || t("value.unknown")}) +
      (lastSample ? ` · ${t("widget.sample", {time: i18n.formatTimestamp(locale, lastSample)})}` : "");
    $("clock").textContent = `${meta.times[cursor]} · ${t("unit.minutes", {count: minutes})}`;
    $("mode-hint").textContent = t(ui.mode.value === "overview" ? "mode.overviewHint" : "mode.asofHint");
    for (const id of ["ranking", "inflows", "outflows"]) $(id).replaceChildren();
    for (const id of ["inflows", "outflows"]) $(`${id}-empty`).hidden = false;
    $("warning").hidden = true; $("empty").hidden = true;
    if (phase !== "ready" || !payload) {
      $("status").textContent = t(phase === "failed" ? "status.failed" : "status.loading", {date: ui.day.value});
      $("scope").textContent = ""; renderWatchlist(cursor, null); renderChart(null, cursor); renderProvenance(); return;
    }
    const ranked = model.rank(payload.boards, type, cursor, minutes, meta.times);
    const selected = model.selectBoard(payload.boards, type, selectedCodes[type]);
    if (selected) persistSelection(type, selected.code);
    renderWatchlist(cursor, selected);
    const start = model.windowStart(meta.times, cursor, minutes);
    $("scope").textContent = start < 0 ? t("status.noWindow") : t("status.scope", {start: meta.times[start], end: meta.times[cursor], count: count(ranked.length)});
    const observed = payload.counts[type] || {observedPoints: 0, expectedBoards: null};
    const expected = observed.expectedBoards === null ? null : observed.expectedBoards * meta.times.length;
    $("status").textContent = expected === null ? t("status.coverageUnknown", {date: ui.day.value, observed: count(observed.observedPoints)}) :
      t("status.coverage", {date: ui.day.value, observed: count(observed.observedPoints), expected: count(expected)});
    const warnings = [];
    if (!payload.hasCatalog) warnings.push(t("warning.noCatalog"));
    if (payload.hasCatalog && ui.mode.value === "asof" && model.catalogAfterCursor(payload.provenance?.catalogCapturedAtMax, ui.day.value, meta.times[cursor])) {
      warnings.push(t("warning.lateCatalog", {captured: i18n.formatTimestamp(locale, payload.provenance.catalogCapturedAtMax)}));
    }
    if (expected !== null && observed.observedPoints < expected) warnings.push(t("warning.partial"));
    const through = ui.mode.value === "overview" ? meta.times.length : cursor + 1;
    if (selected && selected.values.slice(0, through).some(value => value === null)) warnings.push(t("warning.gaps"));
    if (payload.warnings?.length && payload.hasCatalog) warnings.push(t("warning.archive"));
    $("warning").textContent = warnings.join("\n"); $("warning").hidden = !warnings.length;
    renderRanking("ranking", ranked, selected);
    const directions = model.directionalRanks(payload.boards, type, cursor, minutes, meta.times);
    for (const id of ["inflows", "outflows"]) {
      renderRanking(id, directions[id], selected);
      $(`${id}-empty`).hidden = directions[id].length > 0;
    }
    $("empty").hidden = ranked.length > 0;
    renderChart(selected, cursor); renderProvenance();
  }
  function listBoards() {
    const boards = (payload?.boards || []).filter(board => board.type === ui.kind.value).sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
    $("boardlist").replaceChildren(...boards.map(board => option(displayName(board), board.code)));
  }
  function translate() {
    document.documentElement.lang = locale; document.title = t("app.title"); ui.language.value = locale;
    for (const element of document.querySelectorAll("[data-i18n]")) {
      element.textContent = t(element.dataset.i18n, element.dataset.count ? {count: element.dataset.count} : undefined);
    }
    ui.lookup.placeholder = t("control.searchPlaceholder"); $("chart").setAttribute("aria-label", t("chart.label")); render();
  }
  const loader = model.createDayLoader(date => new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = `${date}.js`;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => { script.remove(); reject(new Error("Local day script unavailable")); };
    document.head.append(script);
  }), window.ARCHIVE_DAYS);
  async function loadDay() {
    payload = null; lastSample = null; phase = "loading"; ui.minute.value = "0"; ui.lookup.value = ""; listBoards(); render();
    try {
      const result = await loader.load(ui.day.value);
      if (result.stale) return;
      payload = result.payload;
      const last = payload.boards.reduce((latest, board) => Math.max(latest, board.values.findLastIndex(Number.isFinite)), -1);
      lastSample = last < 0 ? null : `${result.date}T${meta.times[last]}:00+08:00`;
      phase = "ready"; listBoards(); render();
    } catch (_) { phase = "failed"; payload = null; listBoards(); render(); }
  }
  ui.day.replaceChildren(...[...meta.dates].reverse().map(date => option(date, date)));
  ui.day.onchange = loadDay;
  ui.kind.onchange = () => { ui.lookup.value = ""; listBoards(); render(); };
  ui.win.onchange = render; ui.minute.oninput = render; ui.mode.onchange = render;
  ui.language.onchange = () => { locale = i18n.saveLocale(storage, ui.language.value); translate(); };
  ui.lookup.onchange = () => {
    const value = ui.lookup.value.trim().toLowerCase();
    const board = payload?.boards.find(item => item.type === ui.kind.value && (item.code.toLowerCase() === value || item.name.toLowerCase() === value));
    if (board) { persistSelection(ui.kind.value, board.code); render(); }
    else if (value) $("value").textContent = t("status.notFound");
  };
  $("compact").onclick = () => {
    compact = !compact;
    try { if (storage) storage.setItem(compactKey, String(compact)); } catch (_) { /* Optional storage. */ }
    render();
  };
  $("pin").onclick = () => {
    if (phase !== "ready") return;
    const selected = model.selectBoard(payload.boards, ui.kind.value, selectedCodes[ui.kind.value]);
    if (selected && pins.length < 12 && !pins.some(pin => pin.type === selected.type && pin.code === selected.code)) {
      pins = model.normalizePins([...pins, {code: selected.code, type: selected.type}]); savePins(); render();
    }
  };
  $("export-observation").onclick = () => {
    if (phase !== "ready" || !payload || !pins.length) return;
    const record = model.observationRecord({boards: payload.boards, pins, cursor: Number(ui.minute.value),
      times: meta.times, day: ui.day.value, archive: meta.archive || {}, provenance: payload.provenance || {}});
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2) + "\n"], {type: "application/json"}));
    const link = node("a"); link.href = url;
    link.download = `board-flow-observation-${record.day}-${record.cursor.replace(":", "")}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  translate(); loadDay();
})();
