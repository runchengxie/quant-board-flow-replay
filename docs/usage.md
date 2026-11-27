# Reading a replay

[简体中文](usage.zh-CN.md)

Select a date, board category and window. The initial cursor is the first minute;
the initial board is selected by code, not by its closing rank. A deliberate board
selection stays fixed as the cursor or window changes.

As-of display hides observations after the cursor and computes the vertical axis
from visible points only. Full-day overview must be explicitly selected. Neither
mode proves historical availability: minutes were archived after observation and
may contain vendor revisions. Catalog collection time is shown separately.

Rankings subtract cumulative main-flow values at the exact two endpoints. Every
point in the interval must exist, and the interval cannot cross lunch. Missing
data are never zero or interpolated. Values are stored in yuan and displayed in
units of 100 million yuan in both languages; timestamps use Asia/Shanghai.

The page reports whole-day observed/expected points separately from the current
comparison window. Without a daily catalog, names fall back to codes and the
expected universe is unknown. A later global catalog is never a substitute.
Counts do not establish point-in-time membership or independent nonoverlapping
boards. The displayed provenance distinguishes trading day, archive snapshot and
minute/catalog collection times.

The application only visualizes archived minute curves. Actual intraday snapshots
are a different asset and remain in the provider archive. No gaps are repaired,
provider calls made or production aliases updated by opening or building a page.

Largest inflows includes only positive window changes, from largest to smallest;
largest outflows includes only negative changes, from most negative upwards.
Each shows at most 12 sectors and breaks ties by code. Zero changes belong to
neither direction. Both remain visible in Compact window. The separate signed
ranking keeps its descending order, including zero and negative values.

## Fixed watchlist observations

Before reviewing a day, record your sector identities (`type` and `code`), chosen
observation times in Asia/Shanghai, question and exclusion rules in a dated note
outside the source repository. Keep that original note. Add those identities to
the watchlist; do not replace missing sectors or retrospectively substitute the
day's winners. Browser preferences are editable convenience storage, not evidence
that a list was fixed before observation.

After archival, select the day and each predetermined cursor, retain the fixed
watchlist and use **Export observation JSON**. Each download records the fixed
order, same-day names, all 5/15/30-minute changes, unavailable values as `null`,
archive manifest identity and available collection provenance. Early-session,
missing and lunch-crossing windows stay unavailable. These are backward-looking
flow differences ending at the cursor, not forward returns. Exports always use
stable machine keys, yuan divided by 100 million, and Shanghai clock times.

Keep the downloads, original plan and a short dated interpretation under your
project's external data directory. Record gaps, catalog timing, deviations from
the plan and competing explanations. Compare the same identities, times and
windows across days; document any list revision before its next use. A useful
first question is whether observed flow changes persist or reverse across the
three windows, without selecting cases after seeing their outcome.

The export is a retrospective research record (`pointInTime: false`), not an
immutable precommitment or a return calculation. Post-close archived curves and
catalogs cannot establish real-time signal availability, strategy profitability
or live-signal acceptance. Those require separate point-in-time capture, a
prespecified test and independent price/execution data. No research result is
implied by successful export or a populated ranking.
