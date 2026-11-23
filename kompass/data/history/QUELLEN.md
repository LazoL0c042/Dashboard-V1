# Quellen der historischen Reihen (`annual.csv`)

Erzeugt mit `python scripts/build_history.py --download`. Rohdaten liegen in `data/raw/`.

| Spalte | Was | Quelle | Zeitraum |
|---|---|---|---|
| `aktien` | US-Aktien (S&P 500) Gesamtrendite, Dividenden reinvestiert | Robert Shiller, „Irrational Exuberance“-Daten, via datahub.io `s-and-p-500` | 1872–2022 |
| `anleihen` | US-Staatsanleihen 10 J., **Näherung**: Kupon + Kursänderung (Duration 8) | Shiller „Long Interest Rate“ (GS10), gleiche Datei | 1872–2022 |
| `gold` | Goldpreis USD, Dezember zu Dezember | Weltbank „Pink Sheet“ via datahub.io `gold-prices` | 1972–2025 |
| `inflation` | US-Verbraucherpreise (CPI-U), Dez/Dez | US Bureau of Labor Statistics via datahub.io `cpi-us`; vor 1914 Shiller | 1872–2025 |

## Grenzen (werden im Rechner angezeigt)

- **Ersatzwerte:** US-Aktien stehen für „Aktien Welt“, weil frei verfügbare MSCI-World-Daten
  erst ab 1970 und nicht als offener Datensatz existieren. Die USA waren im 20. Jahrhundert
  einer der erfolgreichsten Märkte – das macht die Szenarien eher zu **optimistisch**.
- **Währung:** alles in USD und mit US-Inflation. Wechselkursschwankungen EUR/USD fehlen.
- **Glättung:** Shiller nutzt Monatsdurchschnitte, Extremjahre fallen dadurch etwas milder aus
  (z. B. 2022: −15 % statt −18 %).
- **Anleihen** sind eine Näherung aus der Rendite, keine echten Indexdaten.
- **Gold** erst ab 1972, weil der Preis vorher staatlich festgelegt war.
- **Tagesgeld, Krypto, Immobilien:** keine seriöse lange Reihe → Rechner arbeitet dort nur
  mit deiner eigenen Annahme, klar als solche markiert.
- Die Rohdaten enden bei Aktien/Anleihen 2022, weil die Dividendenreihe danach unvollständig ist.
