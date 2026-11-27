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
