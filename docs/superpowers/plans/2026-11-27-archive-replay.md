# Archive replay implementation plan

> **For agentic workers:** Use executing-plans for the Python/contract task and
> coordinated frontend work for this same deliverable. Root owns Git and Python;
> the frontend worker owns static assets and Node unit tests.

**Goal:** Deliver a reproducible offline replay without copying collection.
**Architecture:** Read-only archive validation, new immutable static output,
classic JavaScript presentation with no remote resources.
**Tech stack:** Python 3.12+, PyArrow, vanilla JavaScript, Node, Playwright.
**Spec:** ../specs/2026-11-27-archive-replay-design.md

## Global constraints

No real data in Git; no source/archive mutation; no output inside the checkout;
no future-data display in as-of mode; no latest-catalog historical fallback;
default English; explicitly mark post-close non-PIT provenance.

## Review focus

Unsafe manifest paths and SQL are rejected rather than executed. Duplicate keys,
corrupt hashes and malformed timestamps fail before output publication. Missing
catalogs cannot create false full coverage. Gaps and lunch never become zero.
Rapid date switches cannot display another day's payload under the selected date.

## Tasks

- [ ] Write failing synthetic archive validation/build tests, then implement
  archive.py, build.py and cli.py. Check all input/atomic publication failures.
- [ ] Write failing pure model tests, then implement static UI and locale catalogs.
  Prove future spikes cannot affect as-of points or axis.
- [ ] Build from synthetic and real archives to separate task directories.
  Compare all replay values to source archive and readonly SQLite.
- [ ] Run real browser checks for dates, categories, windows, selection, cursor,
  locale, missing catalog, lunch, mobile layout and offline requests.
- [ ] Run full Python/Node/static/type/dependency checks, review source-only diff,
  commit, push and open PR. Validate the current target before normal merge.
- [ ] Preserve source/lock identity and results; retain stable page output and
  retire only this task's merged branch/worktree and disposable cache.
