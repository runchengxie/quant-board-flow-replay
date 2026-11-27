import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const args = process.argv.slice(2).filter(value => value !== "--");
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const bundle = value("--bundle"), output = value("--out"), oraclePath = value("--expected");
if (!bundle || !output) throw Error("Usage: --bundle NEW_BUNDLE --out TASK_OUTPUT [--expected SQL_ORACLE_JSON]");
await fs.mkdir(output, {recursive: true});
const oracle = oraclePath ? JSON.parse(await fs.readFile(oraclePath, "utf8")) : null;
const browser = await chromium.launch({headless: true, chromiumSandbox: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
const context = await browser.newContext({viewport: {width: 1280, height: 900}});
const errors = [], external = [], checks = [];
await context.route(/^https?:\/\//, route => {external.push(route.request().url()); return route.abort();});
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
async function ready(day) {
  await page.waitForFunction(expected => document.querySelector("#provenance dd")?.textContent === expected,
    day, {timeout: 10000});
}
async function cursor(index) {
  await page.locator("#minute").evaluate((element, next) => {
    element.value = String(next); element.dispatchEvent(new Event("input"));
  }, index);
}
try {
  await page.goto(pathToFileURL(path.resolve(bundle, "index.html")).href);
  const meta = await page.evaluate(() => window.REPLAY_META);
  const latest = meta.dates.at(-1);
  await ready(latest);
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.locator("#minute").inputValue(), "0");
  assert.equal(await page.locator("#mode").inputValue(), "asof");
  assert.equal(await page.locator("#ranking button").count(), 0);
  checks.push("English default, first cursor, as-of mode and no premature ranking");
  for (const day of meta.dates) {
    await page.selectOption("#day", day); await ready(day);
    for (const kind of ["concept", "industry", "region"]) {
      await page.selectOption("#kind", kind); await cursor(239);
      for (const minutes of [5, 15, 30]) {
        await page.selectOption("#win", String(minutes));
        const observed = await page.locator("#ranking tr").evaluateAll(rows => rows.map(row => ({
          code: row.querySelector("button").dataset.code, amount: row.lastElementChild.textContent
        })));
        const expected = oracle?.[day]?.[kind]?.[minutes];
        if (expected) {
          assert.deepEqual(observed.map(row => row.code), expected.map(row => row[0]));
          const text = expected.map(([, amount]) => (amount > 0 ? "+" : "") +
            new Intl.NumberFormat("en", {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(amount / 1e8));
          assert.deepEqual(observed.map(row => row.amount), text);
        }
        const directions = await page.evaluate(({day, kind, minutes}) => {
          const end = 239, start = end - minutes;
          const rows = window.ARCHIVE_DAYS[day].boards.filter(b => b.type === kind &&
            b.values.slice(start, end + 1).every(v => typeof v === "number" && Number.isFinite(v)))
            .map(b => ({code: b.code, delta: b.values[end] - b.values[start]}));
          const tie = (a,b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
          return {inflows: rows.filter(r => r.delta > 0).sort((a,b) => b.delta-a.delta || tie(a,b)).slice(0,12).map(r=>r.code),
            outflows: rows.filter(r => r.delta < 0).sort((a,b) => a.delta-b.delta || tie(a,b)).slice(0,12).map(r=>r.code)};
        }, {day,kind,minutes});
        for (const id of ["inflows", "outflows"]) {
          assert.deepEqual(await page.locator(`#${id} button`).evaluateAll(buttons=>buttons.map(b=>b.dataset.code)), directions[id]);
        }
        assert.ok(observed.length > 0, `No ${kind} ranking on ${day}`);
      }
    }
    const hasCatalog = meta.coverage[day].hasCatalog;
    if (!hasCatalog) {
      assert.equal(await page.locator("#warning").isVisible(), true);
      const name = await page.locator("#boardname").textContent();
      assert.match(name, /^BK\d+$/);
    }
  }
  checks.push(`All ${meta.dates.length} dates, three categories and 5/15/30 windows; SQL oracle if supplied`);
  await page.selectOption("#kind", "concept"); await cursor(10);
  const before = await page.locator("#chart").innerHTML();
  const selected = await page.locator("#boardname").textContent();
  const changed = await page.evaluate(() => {
    const day = document.querySelector("#day").value;
    const code = document.querySelector("#boardname").textContent.match(/BK\d+/)[0];
    const board = window.ARCHIVE_DAYS[day].boards.find(item => item.code === code);
    const original = board.values[11]; board.values[11] = 1e18;
    return {day, code, original};
  });
  await cursor(10);
  assert.equal(await page.locator("#chart").innerHTML(), before);
  await page.selectOption("#mode", "overview");
  assert.notEqual(await page.locator("#chart").innerHTML(), before);
  await page.evaluate(({day, code, original}) => {
    window.ARCHIVE_DAYS[day].boards.find(item => item.code === code).values[11] = original;
  }, changed);
  await page.selectOption("#mode", "asof");
  assert.equal(await page.locator("#boardname").textContent(), selected);
  await cursor(120);
  assert.equal(await page.locator("#ranking button").count(), 0);
  checks.push("Future spike cannot change as-of curve or axis; overview explicit; lunch window excluded");
  await cursor(239); await page.selectOption("#kind", "industry");
  if (await page.locator("#ranking button").count() > 1) {
    await page.locator("#ranking button").nth(1).click();
    const deliberate = await page.locator("#boardname").textContent();
    await cursor(200);
    assert.equal(await page.locator("#boardname").textContent(), deliberate);
  }
  await page.selectOption("#language", "zh-CN");
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  await page.reload(); await ready(latest);
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  checks.push("Explicit selection stays fixed and language choice survives reload");
  await cursor(239);
  await page.locator("#pin").click();
  assert.equal(await page.locator("#watchlist tr").count(), 1);
  const watched = await page.evaluate(() => {
    const pin = JSON.parse(localStorage.getItem("board-flow-replay.watchlist"))[0];
    const board = window.ARCHIVE_DAYS[document.querySelector("#day").value].boards.find(item => item.code === pin.code && item.type === pin.type);
    return {pin, deltas: [5,15,30].map(n => board.values.slice(239-n,240).every(v => typeof v === "number" && Number.isFinite(v)) ? board.values[239]-board.values[239-n] : null)};
  });
  for (const [index, delta] of watched.deltas.entries()) {
    const text = await page.locator("#watchlist tr td").nth(index+1).textContent();
    const expected = delta === null ? "—" : `${delta > 0 ? "+" : ""}${new Intl.NumberFormat("zh-CN", {minimumFractionDigits:2,maximumFractionDigits:2}).format(delta/1e8)}`;
    assert.equal(text, expected);
  }
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-observation").click();
  const download = await downloadEvent;
  const exportedPath = path.join(output, download.suggestedFilename());
  await download.saveAs(exportedPath);
  const exported = JSON.parse(await fs.readFile(exportedPath, "utf8"));
  assert.equal(exported.pointInTime, false); assert.equal(exported.rows[0].code, watched.pin.code);
  assert.deepEqual([5,15,30].map(n=>exported.rows[0].deltas[n]), watched.deltas);
  assert.equal(exported.archive.manifestSha256, meta.archive.manifestSha256);
  assert.deepEqual({unit: exported.unit, deltas: [5,15,30].map(n=>exported.rows[0].deltas[n])},
    {unit: "CNY", deltas: watched.deltas});
  const amountCase = await page.evaluate(pin => {
    const board = window.ARCHIVE_DAYS[document.querySelector("#day").value].boards.find(b=>b.code===pin.code&&b.type===pin.type);
    const saved = [...board.values];
    board.values.fill(0); board.values[239] = 100000000;
    document.querySelector("#minute").dispatchEvent(new Event("input"));
    return saved;
  }, watched.pin);
  const amountDownloadEvent = page.waitForEvent("download");
  await page.locator("#export-observation").click();
  const amountDownload = await amountDownloadEvent;
  const amountPath = path.join(output, "unit-case-observation.json");
  await amountDownload.saveAs(amountPath);
  const amountRecord = JSON.parse(await fs.readFile(amountPath, "utf8"));
  assert.deepEqual({unit: amountRecord.unit, deltas: [5,15,30].map(n=>amountRecord.rows[0].deltas[n])},
    {unit: "CNY", deltas: [100000000,100000000,100000000]});
  await page.evaluate(({pin, values}) => {
    const board = window.ARCHIVE_DAYS[document.querySelector("#day").value].boards.find(b=>b.code===pin.code&&b.type===pin.type);
    board.values = values;
    document.querySelector("#minute").dispatchEvent(new Event("input"));
  }, {pin: watched.pin, values: amountCase});
  checks.push("Actual downloaded JSON pairs unit CNY with original yuan deltas, including a 100000000-yuan case");
  checks.push("Downloaded fixed-watchlist JSON preserves 5/15/30 values, manifest and retrospective scope");
  await page.locator("#compact").click();
  await page.reload(); await ready(latest);
  assert.equal(await page.locator("html").getAttribute("class"), "widget");
  assert.equal(await page.locator("#watchlist tr").count(), 1);
  assert.equal(await page.locator(".direction-panel").isVisible(), true);
  await cursor(122);
  assert.equal(await page.locator("#inflows tr").count(), 0);
  assert.equal(await page.locator("#outflows tr").count(), 0);
  checks.push("Directional tables match direct archive subtraction and remain visible in compact mode; lunch windows are excluded");
  assert.match(await page.locator("#archive-state").textContent(), /未连接实时采集/);
  await page.locator("#watchlist tr td button").first().click();
  assert.equal(await page.locator("#kind").inputValue(), watched.pin.type);
  assert.match(await page.locator("#boardname").textContent(), new RegExp(watched.pin.code));
  await cursor(40);
  const unavailable = await page.evaluate(pin => {
    const payload = window.ARCHIVE_DAYS[document.querySelector("#day").value];
    const index = payload.boards.findIndex(b => b.code === pin.code && b.type === pin.type);
    const board = payload.boards.splice(index,1)[0];
    window.__removedBoard = {index,board};
    document.querySelector("#minute").dispatchEvent(new Event("input"));
    return document.querySelector("#watchlist tr").textContent;
  }, watched.pin);
  assert.match(unavailable, /当日无数据/);
  assert.equal(await page.locator("#watchlist tr td").nth(1).textContent(), "—");
  await page.evaluate(() => {
    const removed = window.__removedBoard;
    window.ARCHIVE_DAYS[document.querySelector("#day").value].boards.splice(removed.index,0,removed.board);
    delete window.__removedBoard;
    document.querySelector("#minute").dispatchEvent(new Event("input"));
  });
  checks.push("Watchlist 5/15/30 signed deltas, identity persistence, cross-category selection, missing-board preservation and compact mode reload");
  await cursor(239);
  await page.screenshot({path: path.join(output, "desktop.png"), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({path: path.join(output, "mobile.png"), fullPage: true});
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  checks.push("Desktop/mobile layout, no page errors, no external requests");
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify({status: "passed",
    browser: browser.version(), bundle: path.resolve(bundle), checks, errors, external}, null, 2));
  console.log(JSON.stringify({status: "passed", checks}));
} finally { await context.close(); await browser.close(); }
