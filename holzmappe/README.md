# Holzmappe – Peters Zimmerei

Interaktive 3D-Reise durch acht Holzwelten (Kiefer, Fichte, Tanne, Lärche, Douglasie, Eiche, Robinie, Buche)
mit geprüften Fachwerten und der Holzmappe zum Aufschlagen. Spezifikation: `docs/superpowers/specs/2026-11-06-holzmappe-fantasy-design.md`.

**Fertige Datei:** `dist/holzmappe.html` – einfach im Browser öffnen (läuft offline; Schriften kommen bei Internet von Google Fonts).

> Die Fotos (`fotos/`) und die daraus gebaute Datei (`dist/`) sind **nicht im Repo**, weil das Repo öffentlich ist und die Fotos fremde Quellen haben. Für einen eigenen Build die Fotos als `fotos/<holz>-<baum|holz|frucht>.jpg` ablegen.

## Bauen
```
npm install
node build.mjs        # erzeugt dist/holzmappe.html (Code, three.js und Fotos eingebettet)
```

## Aufbau (`src/`)
| Datei | Inhalt |
|---|---|
| `data.js` | Fachdaten aller Hölzer, Quellen, Korrekturliste, Fachbegriffe |
| `engine.js` | Renderer, Kupferstich-Nachbearbeitung, Qualitätsstufen, Kamera, Wind |
| `tree.js` | Prozeduraler Baum-Generator je Art, Früchte, Hintergrundwald |
| `env.js` | Himmel, Gelände, Bergketten, Gras, Nebel, Lichtstrahlen, Partikel, Wasser |
| `props.js` | Eigenschafts-Requisiten: Stammscheibe, Brett, Trocknungsstapel, Brinell-Prüfstand, Harz, Holztafel |
| `werk.js` | Werkstücke (Dachstuhl, Fenster, BSH, Geige, Schrank, …) |
| `realms.js` | Die acht Reiche (Licht, Stimmung, Anordnung, Ton) |
| `special.js` | Prolog, Weltkarte, Werkstatt |
| `pages.js` / `icons.js` | Detailseiten, Mappe, gestochene SVG-Grafiken und Logo |
| `audio.js` | Im Browser erzeugter Umgebungsklang |
| `main.js` / `index.html` | Ablauf, Buch, Karte, Overlay, Mappe, Druckansicht |

## Direkteinstieg (URL-Parameter)
`?start=buch&p=3` · `?start=karte` · `?start=realm&r=tanne` · `?start=werkstatt` · `?start=mappe` · Qualität erzwingen: `&q=low|medium|high`

Die Fotos stammen aus der Ursprungsfassung und sind nur für den privaten Lerngebrauch bestimmt.
