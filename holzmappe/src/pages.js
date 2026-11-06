import { HOELZER, QUELLEN, KORREKTUREN, GLOSSAR, BILDQUELLEN, LEBEN } from './data.js';
import { emblemSVG, shrinkSVG, hardnessSVG, logoSVG, EINSATZ_LABEL, STATE_LABEL } from './icons.js';
import { PHOTOS } from './photos.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const num = n => String(n).replace('.', ',');

export function chapterLabel(i) { return `Kapitel ${ROMAN[i]}`; }

const rw = (L, k) => L.q[k] === 'LIT' ? ' <em class="rw">Richtwert</em>' : '';
function lebenRows(h) {
  const L = LEBEN[h.id];
  return [
    ['Samen & Reife', L.samen + rw(L, 'samen')],
    ['Verbreitung', L.verbreitung],
    ['Keimung', L.keimung + rw(L, 'keimung')],
    ['Mannbarkeit', L.mannText + rw(L, 'mann')],
    ['Umtriebszeit', `${L.umtrieb[0]}–${L.umtrieb[1]} Jahre` + rw(L, 'umtrieb')],
    ['Endhöhe', L.endHText + rw(L, 'endH')],
    ['Höchstalter', L.maxAgeText + rw(L, 'maxAge')],
  ];
}

function werteTable(h) {
  const rows = [
    ['Kurzzeichen (DIN EN 13556)', h.kurz],
    ['Herkunft', h.herkunft],
    ['Rohdichte', h.rohdichte],
    ['Brinell-Härte quer', h.brinell],
    ['Brinell-Härte längs', h.brinellLaengs],
    ['Schwindmaß radial / tangential', `${num(h.schwund.radial)} % / ${num(h.schwund.tangential)} % (frisch → darrtrocken)`],
    ['Differentielles Schwindmaß r / t', `${h.diff.radial} / ${h.diff.tangential} % je % Holzfeuchte`],
    ['Dauerhaftigkeit (DIN EN 350)', h.dauerhaftigkeit],
    ['Gebrauchsklasse', h.gebrauchsklasse],
    ['Festigkeit', h.festigkeit],
    ['Preis (Richtwert)', h.preis],
  ];
  return `<table class="werte">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`;
}

function einsatzBlock(h) {
  return `<div class="einsatz">${['innen', 'aussen', 'tragend', 'dekorativ'].map(k => `
    <figure class="em em-${h.einsatz[k]}">${emblemSVG(k, h.einsatz[k], { size: 62 })}
      <figcaption><b>${EINSATZ_LABEL[k]}</b><span>${STATE_LABEL[h.einsatz[k]]}</span><small>${esc(h.einsatzText[k])}</small></figcaption></figure>`).join('')}</div>`;
}

const PROP_ICONS = {
  harz: '<svg viewBox="0 0 24 24"><path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 15a3 3 0 0 0 3 3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  trocknung: '<svg viewBox="0 0 24 24"><path d="M3 18h18M3 14h18M3 10h18" stroke="currentColor" stroke-width="1.6"/><path d="M6 8V20M12 8V20M18 8V20" stroke="currentColor" stroke-width="1" stroke-dasharray="1.5 1.5"/><circle cx="18" cy="4" r="2" fill="none" stroke="currentColor"/></svg>',
  arbeiten: '<svg viewBox="0 0 24 24"><path d="M3 10q9 6 18 0" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 14q9 6 18 0" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4l-2 3 2 1M16 4l2 3-2 1" fill="none" stroke="currentColor"/></svg>',
  aussehen: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="5" ry="3" fill="none" stroke="currentColor"/><ellipse cx="12" cy="12" rx="1.6" ry="1" fill="currentColor"/></svg>',
  bearbeitung: '<svg viewBox="0 0 24 24"><path d="M3 15h14l3-3H6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 12l2-5h3l-1 5" fill="none" stroke="currentColor"/></svg>',
};

export function detailHTML(h, i) {
  return `
  <header class="d-head">
    <div class="d-kicker">${chapterLabel(i)} · ${esc(h.reich)}</div>
    <h2>${esc(h.name)}</h2>
    <p class="d-sub"><i>${esc(h.bot)}</i> · ${esc(h.en)} · ${esc(h.typ)}</p>
  </header>
  <div class="d-grid">
    <section class="d-werte"><h3>Steckbrief</h3>${werteTable(h)}</section>
    <section class="d-fig">
      <h3>Schwinden</h3>${shrinkSVG(h, { w: 310 })}
      <h3>Härte im Vergleich</h3>${hardnessSVG(HOELZER, h.id, { w: 290 })}
    </section>
    <section class="d-props"><h3>Eigenschaften</h3>
      ${[['harz', 'Harz & Inhaltsstoffe', h.harz], ['trocknung', 'Trocknung', h.trocknung], ['arbeiten', 'Schwund & Arbeiten', `${h.stehvermoegen} Tangential schwindet ${h.name} mit ${num(h.schwund.tangential)} % rund ${num((h.schwund.tangential / h.schwund.radial).toFixed(1))}-mal so stark wie radial (${num(h.schwund.radial)} %).`], ['aussehen', 'Aussehen & Maserung', h.aussehen], ['bearbeitung', 'Bearbeitung', h.bearbeitung]]
        .map(([k, t, v]) => `<div class="prop"><span class="pi">${PROP_ICONS[k]}</span><div><h4>${t}</h4><p>${esc(v)}</p></div></div>`).join('')}
    </section>
    <section class="d-einsatz"><h3>Einsatzbereiche</h3>${einsatzBlock(h)}
      <h3>Typische Werkstücke</h3><ul class="werk">${h.werkstuecke.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      <p class="verw">${esc(h.verwendung)}</p>
      <h3>Lebenslauf</h3><table class="werte">${lebenRows(h).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
      <p class="q">Quellen: ${h.quellen.map(q => `<span title="${esc(QUELLEN[q].titel)}">${q}</span>`).join(', ')} – siehe Quellenverzeichnis der Mappe.</p>
    </section>
  </div>`;
}

export function tocHTML() {
  return `<div class="toc">
    <div class="toc-logo">${logoSVG({ size: 120 })}</div>
    <h2>Inhalt</h2>
    <ol>${HOELZER.map((h, i) => `<li data-ch="${i}"><span class="n">${ROMAN[i]}</span><span class="t">${esc(h.name)}<small>${esc(h.reich)}</small></span><span class="dots"></span><span class="p">${3 + i * 2}</span></li>`).join('')}
      <li data-ch="werkstatt"><span class="n">❦</span><span class="t">Die Werkstatt<small>Die Holzmappe zum Öffnen</small></span><span class="dots"></span><span class="p">${3 + 16}</span></li></ol>
    <p class="hint">Blättern: Seitenrand antippen, wischen oder Pfeiltasten.</p>
  </div>`;
}

// ---------- Die Mappe ----------
export function mappeHTML() {
  const photo = (id, k, cap) => PHOTOS[`${id}-${k}`] ? `<figure><img src="${PHOTOS[`${id}-${k}`]}" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>` : '';
  const steck = HOELZER.map((h, i) => `
    <section class="sheet steckbrief" id="m-${h.id}">
      <header class="sh-head"><div><h2>${esc(h.name)}</h2><p><i>${esc(h.bot)}</i> · ${esc(h.en)} · ${esc(h.typ)}</p></div><div class="sh-logo">${logoSVG({ size: 64 })}</div></header>
      <div class="photos">${photo(h.id, 'baum', 'Baum')}${photo(h.id, 'holz', 'Holz')}${photo(h.id, 'frucht', 'Frucht')}</div>
      <table class="mt">
        <tr><th>Deutscher Name</th><td>${esc(h.name)}</td></tr>
        <tr><th>Botanischer Name</th><td><i>${esc(h.bot)}</i></td></tr>
        <tr><th>Englischer Name</th><td>${esc(h.en)}</td></tr>
        <tr><th>Kurzzeichen (DIN EN 13556)</th><td>${esc(h.kurz)}</td></tr>
        <tr><th>Herkunft</th><td>${esc(h.herkunft)}</td></tr>
        <tr><th>Rohdichte</th><td>${esc(h.rohdichte)}</td></tr>
        <tr><th>Härte (Brinell)</th><td>${esc(h.brinell)}; ${esc(h.brinellLaengs)}</td></tr>
        <tr><th>Schwindmaß gesamt</th><td>radial ${num(h.schwund.radial)} %, tangential ${num(h.schwund.tangential)} %</td></tr>
        <tr><th>Differentielles Schwindmaß</th><td>radial ${h.diff.radial} %/%, tangential ${h.diff.tangential} %/%</td></tr>
        <tr><th>Stehvermögen / Arbeiten</th><td>${esc(h.stehvermoegen)}</td></tr>
        <tr><th>Harz / Inhaltsstoffe</th><td>${esc(h.harz)}</td></tr>
        <tr><th>Trocknung</th><td>${esc(h.trocknung)}</td></tr>
        <tr><th>Dauerhaftigkeitsklasse Kernholz</th><td>${esc(h.dauerhaftigkeit)} (DIN EN 350)</td></tr>
        <tr><th>Gebrauchsklasse</th><td>${esc(h.gebrauchsklasse)}</td></tr>
        <tr><th>Festigkeit</th><td>${esc(h.festigkeit)}</td></tr>
        <tr><th>Aussehen / Maserung</th><td>${esc(h.aussehen)}</td></tr>
        <tr><th>Bearbeitung</th><td>${esc(h.bearbeitung)}</td></tr>
        <tr><th>Einsatz</th><td>${['innen', 'aussen', 'tragend', 'dekorativ'].map(k => `${EINSATZ_LABEL[k]}: <b>${STATE_LABEL[h.einsatz[k]]}</b> (${esc(h.einsatzText[k])})`).join(' · ')}</td></tr>
        <tr><th>Verwendung</th><td>${esc(h.verwendung)}</td></tr>
        <tr><th>Preis (Richtwert)</th><td>${esc(h.preis)}</td></tr>
        ${lebenRows(h).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
      </table>
      <footer class="sh-foot">Peters Zimmerei · Holzmappe · Seite ${i + 3} · Quellen: ${[...new Set([...h.quellen, ...Object.values(LEBEN[h.id].q).flatMap(v => v.split(', '))])].join(', ')}</footer>
    </section>`).join('');

  const bars = (key, label, unit, max, fmt = v => num(v)) => `<figure class="chart"><figcaption>${label}</figcaption><svg viewBox="0 0 420 ${HOELZER.length * 24 + 10}" role="img" aria-label="${label}">
    ${HOELZER.map((h, i) => { const v = typeof key === 'function' ? key(h) : h[key]; const w = v / max * 280; return `<text x="96" y="${i * 24 + 17}" text-anchor="end" class="cl">${h.name}</text><rect x="102" y="${i * 24 + 5}" width="${w}" height="15" class="cb" rx="1"/><text x="${108 + w}" y="${i * 24 + 17}" class="cv">${fmt(v)} ${unit}</text>`; }).join('')}
  </svg></figure>`;

  return `
  <div class="mappe-bar"><button class="m-close" data-act="close-mappe" aria-label="Mappe schließen">✕ Zurück zur Reise</button><nav>${HOELZER.map(h => `<a href="#m-${h.id}">${h.name}</a>`).join('')}<a href="#m-vergleich">Vergleich</a><a href="#m-glossar">Fachbegriffe</a><a href="#m-korrektur">Korrekturen</a><a href="#m-quellen">Quellen</a></nav><button data-act="print">Drucken</button></div>
  <div class="sheets">
    <section class="sheet deck">
      <div class="deck-in">${logoSVG({ size: 200 })}
        <p class="firm">Peters Zimmerei</p><p class="addr">Nonnendammallee 140 · 13599 Berlin</p>
        <h1>Holzmappe</h1><p class="subt">Steckbriefe ausgewählter Nadel- und Laubhölzer</p>
        <div class="deck-cols"><div><h3>Nadelhölzer</h3>${HOELZER.filter(h => h.typ === 'Nadelholz').map(h => `<p>${h.name}</p>`).join('')}</div><div><h3>Laubhölzer</h3>${HOELZER.filter(h => h.typ === 'Laubholz').map(h => `<p>${h.name}</p>`).join('')}</div></div>
        <p class="ed">Überarbeitete und fachlich geprüfte Fassung · 2026</p>
      </div>
    </section>
    <section class="sheet toc-sheet"><h2>Inhaltsverzeichnis</h2><ol class="mtoc">
      ${HOELZER.map((h, i) => `<li><a href="#m-${h.id}">${h.name}</a><span></span><b>${i + 3}</b></li>`).join('')}
      <li><a href="#m-vergleich">Vergleich der Kennwerte</a><span></span><b>11</b></li>
      <li><a href="#m-glossar">Fachbegriffe</a><span></span><b>12</b></li>
      <li><a href="#m-korrektur">Korrekturliste zur Ursprungsfassung</a><span></span><b>13</b></li>
      <li><a href="#m-quellen">Quellenverzeichnis</a><span></span><b>14</b></li></ol>
      <p class="note">Alle Zahlenwerte sind Richtwerte aus der Fachliteratur. Holz ist ein Naturstoff, und die Werte streuen je nach Wuchsort, Rohdichte und Prüfverfahren. Wo Quellen voneinander abweichen, ist eine Spanne angegeben.</p></section>
    ${steck}
    <section class="sheet" id="m-vergleich"><h2>Vergleich der Kennwerte</h2>
      <table class="cmp"><thead><tr><th>Holz</th><th>Rohdichte g/cm³</th><th>Brinell quer N/mm²</th><th>Schwund r / t %</th><th>diff. t %/%</th><th>DK</th><th>Außen</th><th>€/m³</th></tr></thead>
      <tbody>${HOELZER.map(h => `<tr><td>${h.name}</td><td>${num(h.rohdichteNum)}</td><td>${h.brinellNum}</td><td>${num(h.schwund.radial)} / ${num(h.schwund.tangential)}</td><td>${h.diff.tangential}</td><td>${h.dauerhaftigkeit.match(/Klasse ([0-9–]+)/)[1]}</td><td>${STATE_LABEL[h.einsatz.aussen]}</td><td>${h.preis.match(/([0-9.]+–[0-9.]+)/)[1]}</td></tr>`).join('')}</tbody></table>
      <div class="charts">${bars('brinellNum', 'Brinell-Härte quer zur Faser', 'N/mm²', 50)}${bars('rohdichteNum', 'Rohdichte (lufttrocken)', 'g/cm³', 0.85)}${bars(h => h.schwund.tangential, 'Schwindmaß tangential (gesamt)', '%', 13)}</div>
      <p class="note">DK = Dauerhaftigkeitsklasse des Kernholzes nach DIN EN 350 (1 sehr dauerhaft … 5 nicht dauerhaft). Rohdichte: Mittelwert der angegebenen Spanne.</p>
    </section>
    <section class="sheet" id="m-glossar"><h2>Fachbegriffe</h2><dl class="gl">${GLOSSAR.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></section>
    <section class="sheet" id="m-korrektur"><h2>Korrekturliste zur Ursprungsfassung</h2>
      <p class="note">Diese Angaben der ersten Fassung wurden geprüft und berichtigt.</p>
      <table class="kor"><thead><tr><th>Holz</th><th>Ursprungsfassung</th><th>Berichtigt</th><th>Begründung</th><th>Quelle</th></tr></thead>
      <tbody>${KORREKTUREN.map(k => `<tr><td>${esc(k.holz)}</td><td class="alt">${esc(k.alt)}</td><td class="neu">${esc(k.neu)}</td><td>${esc(k.grund)}</td><td>${esc(k.q)}</td></tr>`).join('')}</tbody></table></section>
    <section class="sheet" id="m-quellen"><h2>Quellenverzeichnis</h2>
      <h3>Fachquellen</h3><ul class="ql">${Object.entries(QUELLEN).map(([k, q]) => `<li><b>${k}</b> ${esc(q.titel)}${q.url ? ` – <span class="url">${esc(q.url)}</span>` : ''}</li>`).join('')}</ul>
      <h3>Bildquellen der Fotos</h3><table class="bq"><thead><tr><th>Baumart</th><th>Kategorie</th><th>Quelle</th></tr></thead><tbody>${BILDQUELLEN.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td class="url">${esc(c)}</td></tr>`).join('')}</tbody></table>
      <p class="note">Die Fotos stammen aus der Ursprungsfassung und sind nur für den privaten Lerngebrauch bestimmt. Alle Illustrationen der Reise sind eigens gerendert.</p></section>
  </div>`;
}
