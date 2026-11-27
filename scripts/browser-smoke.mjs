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
  await page.locator("#compact").click();
  await page.reload(); await ready(latest);
  assert.equal(await page.locator("html").getAttribute("class"), "widget");
  assert.equal(await page.locator("#watchlist tr").count(), 1);
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
