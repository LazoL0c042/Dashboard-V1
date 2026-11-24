// Kompass – kleine SVG-Diagramme ohne Bibliothek.
// Linien mit Fadenkreuz und Tooltip, Balkenlisten (auch negativ), Sparklines.
// Farben kommen aus CSS-Variablen (--series-1 …), damit hell/dunkel stimmen.
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };

  function niceTicks(min, max, n = 5) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => span / s <= n) || 10 * mag;
    const out = [];
    for (let v = Math.floor(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  /**
   * Linien-Diagramm.
   * opt: {serien: [{name, farbe: "var(--series-1)", punkte: [[x, y]], strich: "dash"?}],
   *       x: "datum" | "zahl", xFormat, yFormat, hoehe, nullLinie}
   * Alle Serien teilen sich die x-Werte der ersten Serie (Fadenkreuz rastet dort ein).
   */
  function linie(container, opt) {
    container.innerHTML = "";
    container.classList.add("chart");
    const legend = document.createElement("div");
    legend.className = "chart-legend";
    if (opt.serien.length > 1) {
      for (const s of opt.serien) {
        const it = document.createElement("span");
        it.className = "legend-item";
        const key = document.createElement("i");
        key.className = "legend-key" + (s.strich === "dash" ? " dash" : "");
        key.style.setProperty("--k", s.farbe);
        it.appendChild(key);
        it.appendChild(document.createTextNode(s.name));
        legend.appendChild(it);
      }
      container.appendChild(legend);
    }
    const wrap = document.createElement("div");
    wrap.className = "chart-plot";
    container.appendChild(wrap);
    const tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.hidden = true;
    wrap.appendChild(tip);

    const xs = opt.serien[0].punkte.map((p) => (opt.x === "zahl" ? p[0] : Date.parse(p[0])));
    let yMin = Infinity, yMax = -Infinity;
    for (const s of opt.serien) for (const p of s.punkte) { if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1]; }
    if (opt.nullLinie) { yMin = Math.min(yMin, 0); yMax = Math.max(yMax, 0); }
    const pad = (yMax - yMin) * 0.06 || 1;
    const nurPositiv = yMin >= 0;
    const ticks = niceTicks(nurPositiv ? Math.max(0, yMin - pad) : yMin - pad, yMax + pad, 5).filter((t) => !nurPositiv || t >= 0);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];

    const draw = () => {
      const W = Math.max(280, wrap.clientWidth), H = opt.hoehe || 300;
      const endLabels = W > 560 && opt.serien.length <= 4;
      const kurz = (t) => (t.length > 18 ? t.slice(0, 17) + "…" : t);
      const labelBreite = Math.max(...opt.serien.map((s) => kurz(s.name).length)) * 7.4 + 18;
      const yBreite = Math.max(...ticks.map((t) => String(opt.yFormat(t)).length)) * 7 + 14;
      const m = { l: Math.max(44, yBreite), r: endLabels ? Math.min(160, labelBreite) : 14, t: 18, b: 30 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const sx = (x) => m.l + ((x - xs[0]) / Math.max(1, xs[xs.length - 1] - xs[0])) * iw;
      const sy = (y) => m.t + (1 - (y - y0) / (y1 - y0)) * ih;
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", tabindex: "0",
        "aria-label": opt.titel || "Diagramm" });
      // Raster und y-Achse
      for (const t of ticks) {
        svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: sy(t), y2: sy(t), class: t === 0 && opt.nullLinie ? "axis-zero" : "grid" }));
        const lab = el("text", { x: m.l - 8, y: sy(t) + 4, "text-anchor": "end", class: "axis-text" });
        lab.textContent = opt.yFormat(t);
        svg.appendChild(lab);
      }
      // x-Achse: ~5 Beschriftungen
      const nx = Math.min(6, Math.max(2, Math.floor(iw / 110)));
      for (let i = 0; i < nx; i++) {
        const idx = Math.round((i * (xs.length - 1)) / (nx - 1));
        const lab = el("text", { x: sx(xs[idx]), y: H - 8, "text-anchor": i === 0 ? "start" : i === nx - 1 ? "end" : "middle", class: "axis-text" });
        lab.textContent = opt.xFormat(opt.serien[0].punkte[idx][0]);
        svg.appendChild(lab);
      }
      // Linien
      const enden = [];
      opt.serien.forEach((s) => {
        const d = s.punkte.map((p, i) => `${i ? "L" : "M"}${sx(opt.x === "zahl" ? p[0] : Date.parse(p[0])).toFixed(1)},${sy(p[1]).toFixed(1)}`).join("");
        svg.appendChild(el("path", { d, fill: "none", stroke: s.farbe, "stroke-width": 2, "stroke-linejoin": "round",
          "stroke-linecap": "round", "stroke-dasharray": s.strich === "dash" ? "5 5" : "none" }));
        const last = s.punkte[s.punkte.length - 1];
        enden.push({ s, y: sy(last[1]), x: sx(opt.x === "zahl" ? last[0] : Date.parse(last[0])) });
      });
      // Endpunkte und Direktbeschriftung (nur wenn Platz), Kollisionen auseinanderschieben
      enden.sort((a, b) => a.y - b.y);
      if (enden.length) enden[0].y = Math.max(enden[0].y, m.t + 2);
      for (let i = 1; i < enden.length; i++) if (enden[i].y - enden[i - 1].y < 16) enden[i].y = enden[i - 1].y + 16;
      for (const e of enden) {
        svg.appendChild(el("circle", { cx: e.x, cy: sy(e.s.punkte[e.s.punkte.length - 1][1]), r: 4, fill: e.s.farbe, stroke: "var(--card)", "stroke-width": 2 }));
        if (endLabels) {
          const t = el("text", { x: e.x + 10, y: e.y + 4, class: "end-label" });
          t.textContent = kurz(e.s.name);
          svg.appendChild(t);
        }
      }
      // Fadenkreuz
      const cross = el("line", { y1: m.t, y2: H - m.b, class: "crosshair", visibility: "hidden" });
      svg.appendChild(cross);
      const dots = opt.serien.map((s) => { const c = el("circle", { r: 4, fill: s.farbe, stroke: "var(--card)", "stroke-width": 2, visibility: "hidden" }); svg.appendChild(c); return c; });
      const zeige = (idx) => {
        const x = sx(xs[idx]);
        cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
        tip.innerHTML = "";
        const kopf = document.createElement("div");
        kopf.className = "tip-head";
        kopf.textContent = opt.xFormat(opt.serien[0].punkte[idx][0], true);
        tip.appendChild(kopf);
        opt.serien.forEach((s, i) => {
          const p = s.punkte[idx];
          if (!p) return;
          dots[i].setAttribute("cx", x); dots[i].setAttribute("cy", sy(p[1])); dots[i].setAttribute("visibility", "visible");
          const row = document.createElement("div");
          row.className = "tip-row";
          const k = document.createElement("i");
          k.className = "legend-key" + (s.strich === "dash" ? " dash" : "");
          k.style.setProperty("--k", s.farbe);
          const v = document.createElement("b");
          v.textContent = opt.yFormat(p[1], true);
          const n = document.createElement("span");
          n.textContent = s.name;
          row.append(k, v, n);
          tip.appendChild(row);
        });
        tip.hidden = false;
        const tw = tip.offsetWidth;
        tip.style.left = `${Math.min(Math.max(0, x + 12), W - tw - 4)}px`;
        tip.style.top = `${m.t}px`;
      };
      const verstecke = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); };
      const naechster = (px) => {
        const xv = xs[0] + ((px - m.l) / iw) * (xs[xs.length - 1] - xs[0]);
        let lo = 0, hi = xs.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < xv) lo = mid; else hi = mid; }
        return Math.abs(xs[lo] - xv) <= Math.abs(xs[hi] - xv) ? lo : hi;
      };
      let aktiv = xs.length - 1;
      svg.addEventListener("pointermove", (ev) => { const r = svg.getBoundingClientRect(); aktiv = naechster(((ev.clientX - r.left) / r.width) * W); zeige(aktiv); });
      svg.addEventListener("pointerleave", verstecke);
      svg.addEventListener("focus", () => zeige(aktiv));
      svg.addEventListener("blur", verstecke);
      svg.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowLeft") aktiv = Math.max(0, aktiv - 1);
        else if (ev.key === "ArrowRight") aktiv = Math.min(xs.length - 1, aktiv + 1);
        else return;
        ev.preventDefault();
        zeige(aktiv);
      });
      wrap.querySelector("svg")?.remove();
      wrap.insertBefore(svg, tip);
    };
    draw();
    if (root.ResizeObserver) {
      let w = wrap.clientWidth;
      new ResizeObserver(() => { if (Math.abs(wrap.clientWidth - w) > 4) { w = wrap.clientWidth; draw(); } }).observe(wrap);
    }
  }

  /**
   * Horizontale Balken (HTML), auch mit negativen Werten (Nulllinie in der Mitte).
   * zeilen: [{name, wert, text, sub}], opt: {farbe, max}
   */
  function balken(container, zeilen, opt = {}) {
    container.innerHTML = "";
    container.classList.add("bars");
    const neg = zeilen.some((z) => z.wert < 0);
    const max = opt.max || Math.max(...zeilen.map((z) => Math.abs(z.wert)), 1e-9);
    for (const z of zeilen) {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.tabIndex = 0;
      const name = document.createElement("div");
      name.className = "bar-name";
      name.textContent = z.name;
      if (z.sub) { const s = document.createElement("span"); s.className = "bar-sub"; s.textContent = z.sub; name.appendChild(s); }
      const track = document.createElement("div");
      track.className = "bar-track" + (neg ? " diverging" : "");
      const fill = document.createElement("i");
      const anteil = Math.min(1, Math.abs(z.wert) / max) * (neg ? 50 : 100);
      fill.style.width = `${anteil}%`;
      fill.style.background = z.farbe || opt.farbe || "var(--series-1)";
      if (neg) fill.style[z.wert < 0 ? "right" : "left"] = "50%";
      track.appendChild(fill);
      const val = document.createElement("div");
      val.className = "bar-val";
      val.textContent = z.text;
      row.append(name, track, val);
      container.appendChild(row);
    }
  }

  // Sparkline als SVG-Text (für Listen).
  function spark(werte, farbe = "var(--series-1)", w = 120, h = 34) {
    if (!werte || werte.length < 2) return "";
    const min = Math.min(...werte), max = Math.max(...werte), sp = max - min || 1;
    const pts = werte.map((v, i) => `${((i / (werte.length - 1)) * (w - 6) + 3).toFixed(1)},${(h - 3 - ((v - min) / sp) * (h - 6)).toFixed(1)}`);
    const last = pts[pts.length - 1].split(",");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.join(" ")}" fill="none" stroke="${farbe}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${farbe}"/></svg>`;
  }

  root.Charts = { linie, balken, spark, niceTicks };
})(window);
