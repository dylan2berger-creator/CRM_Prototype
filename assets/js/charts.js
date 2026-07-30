/* =============================================================================
   Tiny inline-SVG chart helpers. No external libraries.
   Keeps the prototype self-contained and matches the "read, don't restate"
   posture: charts render whatever the app read, nothing more.
   ========================================================================== */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const money = (n) => {
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return `$${Math.round(n)}`;
  };

  /* Plan-vs-actual line chart with an "action date" marker (E6). */
  function planVsActual(actual, plan, months, actionIndex, opts = {}) {
    const w = opts.w || 640, h = opts.h || 240;
    const padL = 46, padR = 12, padT = 16, padB = 26;
    const iw = w - padL - padR, ih = h - padT - padB;
    const all = actual.concat(plan);
    const min = Math.min(...all) * 0.9, max = Math.max(...all) * 1.05;
    const x = (i) => padL + (i / (months.length - 1)) * iw;
    const y = (v) => padT + ih - ((v - min) / (max - min)) * ih;
    const line = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

    let grid = "";
    for (let g = 0; g <= 4; g++) {
      const gy = padT + (g / 4) * ih;
      const gv = max - (g / 4) * (max - min);
      grid += `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" class="grid"/>`;
      grid += `<text x="${padL - 6}" y="${gy + 3}" class="axis" text-anchor="end">${money(gv)}</text>`;
    }
    // month labels (every 3rd)
    let xlabels = "";
    months.forEach((m, i) => {
      if (i % 3 === 0 || i === months.length - 1)
        xlabels += `<text x="${x(i)}" y="${h - 8}" class="axis" text-anchor="middle">${m}</text>`;
    });

    const ax = x(actionIndex);
    const actionMark = `
      <line x1="${ax}" y1="${padT}" x2="${ax}" y2="${padT + ih}" class="action-line"/>
      <text x="${ax + 4}" y="${padT + 10}" class="action-label">▲ action</text>`;

    // shade recovery window
    const shade = `<rect x="${ax}" y="${padT}" width="${w - padR - ax}" height="${ih}" class="action-shade"/>`;

    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Plan versus actual revenue">
      ${shade}${grid}
      <path d="${line(plan)}" class="plan-line"/>
      <path d="${line(actual)}" class="actual-line"/>
      ${actionMark}${xlabels}
      <g class="legend-inline">
        <rect x="${padL}" y="${padT - 2}" width="10" height="3" class="sw-actual"/>
        <text x="${padL + 14}" y="${padT + 2}" class="axis">Actual</text>
        <rect x="${padL + 62}" y="${padT - 2}" width="10" height="3" class="sw-plan"/>
        <text x="${padL + 76}" y="${padT + 2}" class="axis">Business case</text>
      </g>
    </svg>`;
  }

  /* Horizontal bar chart (revenue by client / DRP) (E4). */
  function hbars(rows, opts = {}) {
    const w = opts.w || 560, rowH = 30, padL = opts.padL || 120, padR = 70;
    const h = rows.length * rowH + 8;
    const max = Math.max(...rows.map((r) => r.value));
    let bars = "";
    rows.forEach((r, i) => {
      const bw = Math.max(2, (r.value / max) * (w - padL - padR));
      const yy = i * rowH + 6;
      const cls = r.className || "bar-default";
      bars += `
        <text x="${padL - 8}" y="${yy + 13}" class="bar-label" text-anchor="end">${escapeXml(r.label)}</text>
        <rect x="${padL}" y="${yy}" width="${bw}" height="18" rx="3" class="${cls}"/>
        <text x="${padL + bw + 6}" y="${yy + 13}" class="bar-value">${r.valueLabel || money(r.value)}</text>`;
      if (r.badge) bars += `<text x="${w - 4}" y="${yy + 13}" class="bar-badge ${r.badgeClass || ""}" text-anchor="end">${escapeXml(r.badge)}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${escapeXml(opts.title || "Bar chart")}">${bars}</svg>`;
  }

  /* Sparkline for tables. */
  function spark(arr, opts = {}) {
    const w = opts.w || 90, h = opts.h || 24;
    const min = Math.min(...arr), max = Math.max(...arr);
    const rng = max - min || 1;
    const pts = arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - ((v - min) / rng) * (h - 4) - 2}`).join(" ");
    const last = arr[arr.length - 1], first = arr[0];
    const cls = last >= first ? "spark-up" : "spark-down";
    return `<svg viewBox="0 0 ${w} ${h}" class="spark ${cls}" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`;
  }

  /* Rank pill vs competitors. */
  function rankPill(rank, total, prev) {
    const delta = prev - rank; // positive = improved (moved up)
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "▬";
    const cls = delta > 0 ? "rank-up" : delta < 0 ? "rank-down" : "rank-flat";
    return `<span class="rank-pill"><b>#${rank}</b><span class="rank-of">/${total}</span> <span class="${cls}">${arrow}${Math.abs(delta) || ""}</span></span>`;
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  }

  window.Charts = { planVsActual, hbars, spark, rankPill, money };
})();
