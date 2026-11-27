(function (root) {
  "use strict";
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const byCode = (a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  function clockMinutes(time) {
    if (typeof time !== "string" || !/^\d\d:\d\d$/.test(time)) return NaN;
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  }
  function session(time) {
    const value = clockMinutes(time);
    return value >= 571 && value <= 690 ? 0 : value >= 781 && value <= 900 ? 1 : -1;
  }
  function windowStart(times, cursor, minutes) {
    if (!Number.isInteger(cursor) || !Number.isInteger(minutes) || minutes <= 0) return -1;
    const start = cursor - minutes;
    if (start < 0 || cursor >= times.length || session(times[cursor]) < 0) return -1;
    return session(times[start]) === session(times[cursor]) &&
      clockMinutes(times[cursor]) - clockMinutes(times[start]) === minutes ? start : -1;
  }
  function rank(boards, type, cursor, minutes, times) {
    const start = windowStart(times, cursor, minutes);
    if (start < 0) return [];
    return boards.filter(board => board.type === type &&
      board.values.length > cursor &&
      board.values.slice(start, cursor + 1).every(finite))
      .map(board => ({board, delta: board.values[cursor] - board.values[start]}))
      .sort((a, b) => b.delta - a.delta || byCode(a.board, b.board));
  }
  function normalizePins(value) {
    if (!Array.isArray(value)) return [];
    const result = [], seen = new Set();
    for (const item of value.slice(0, 100)) {
      if (!item || !["concept", "industry", "region"].includes(item.type) ||
          typeof item.code !== "string" || !/^BK[0-9]{1,12}$/.test(item.code)) continue;
      const key = `${item.type}:${item.code}`;
      if (seen.has(key)) continue;
      seen.add(key); result.push({code: item.code, type: item.type});
      if (result.length === 12) break;
    }
    return result;
  }
  function watchRows(boards, pins, cursor, times) {
    return normalizePins(pins).map(pin => {
      const board = boards.find(item => item.code === pin.code && item.type === pin.type) || null;
      const deltas = {};
      for (const minutes of [5, 15, 30]) {
        const start = windowStart(times, cursor, minutes);
        deltas[minutes] = board && start >= 0 && board.values.length > cursor &&
          board.values.slice(start, cursor + 1).every(finite) ? board.values[cursor] - board.values[start] : null;
      }
      return {...pin, board, deltas};
    });
  }
  function chartModel(board, cursor, mode) {
    const empty = {min: 0, max: 0, segments: [], current: null};
    if (!board || !Array.isArray(board.values) || !Number.isInteger(cursor) ||
        cursor < 0 || cursor >= board.values.length) return empty;
    const end = mode === "overview" ? board.values.length - 1 : cursor;
    const segments = [];
    let segment = [], minimum = 0, maximum = 0;
    for (let index = 0; index <= end; index += 1) {
      const value = board.values[index];
      if (index === 120 || !finite(value)) {
        if (segment.length) segments.push(segment);
        segment = [];
      }
      if (!finite(value)) continue;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
      segment.push({index, value});
    }
    if (segment.length) segments.push(segment);
    return {min: minimum, max: maximum, segments,
      current: finite(board.values[cursor]) ? {index: cursor, value: board.values[cursor]} : null};
  }
  function axisLabels(minimum, maximum, height, minimumGap) {
    const selected = [];
    for (const value of [...new Set([maximum, minimum, 0])]) {
      const position = (maximum - value) * height / (maximum - minimum || 1);
      if (selected.every(label => Math.abs(label.position - position) >= minimumGap)) selected.push({value, position});
    }
    return selected.sort((a, b) => a.position - b.position);
  }
  function catalogAfterCursor(capturedAt, day, clock) {
    if (typeof capturedAt !== "string" || !capturedAt) return false;
    let iso = capturedAt.replace(" ", "T");
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(iso)) iso += "+08:00";
    const captured = Date.parse(iso), cursor = Date.parse(`${day}T${clock}:00+08:00`);
    return Number.isFinite(captured) && Number.isFinite(cursor) && captured > cursor;
  }
  function selectBoard(boards, type, preferredCode) {
    const eligible = boards.filter(board => board.type === type);
    return eligible.find(board => board.code === preferredCode) || eligible.sort(byCode)[0] || null;
  }
  function createDayLoader(loadScript, cache) {
    let version = 0;
    return {
      async load(date) {
        const current = ++version;
        try {
          if (!Object.prototype.hasOwnProperty.call(cache, date)) await loadScript(date);
          if (current !== version) return {date, stale: true};
          const payload = cache[date];
          if (!payload || !Array.isArray(payload.boards)) throw new Error("Invalid archive day payload");
          return {date, payload, stale: false};
        } catch (error) {
          if (current !== version) return {date, stale: true};
          throw error;
        }
      }
    };
  }
  root.ReplayModel = Object.freeze({windowStart, rank, chartModel, axisLabels, catalogAfterCursor, selectBoard, createDayLoader, normalizePins, watchRows});
})(window);
