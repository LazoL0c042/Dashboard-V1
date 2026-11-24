"""Deutsche Steuer auf Kapitalerträge – vereinfachtes Modell für den Rechner.

Was berücksichtigt wird: Abgeltungsteuer + Soli, optional Kirchensteuer,
Sparerpauschbetrag, Teilfreistellung, Vorabpauschale (jährlich), steuerfreie
Veräußerung von Gold physisch / Xetra-Gold / Krypto (direkt) nach > 1 Jahr.
Vereinfachungen: jährlich gezahlte Steuer mindert den Zinseszins nicht;
der Pauschbetrag wird voll für diese Anlage genutzt.
"""
import json
from functools import lru_cache
from pathlib import Path

CONFIG = Path(__file__).resolve().parent.parent / "data" / "steuer_de.json"

KLASSEN = {
    "aktien_etf": "Aktien-ETF (≥ 51 % Aktien)",
    "misch": "Mischfonds (≥ 25 % Aktien)",
    "anleihen_etf": "Anleihen-/Geldmarkt-ETF",
    "zinsen": "Tagesgeld/Festgeld (Zinsen jährlich)",
    "gold_physisch": "Gold physisch / Xetra-Gold",
    "krypto_direkt": "Krypto direkt gehalten",
    "sonstiges": "Sonstiges (ohne Teilfreistellung)",
    "immobilienfonds": "Offener Immobilienfonds (Teilfreistellung 60 %)",
    "immobilie_privat": "Eigene Immobilie (vermietet)",
}


@lru_cache(maxsize=1)
def config() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def steuersatz(kirchensteuer: float | None = None) -> float:
    """Effektiver Satz inkl. Soli (und KiSt nach § 32d Abs. 1 S. 3 EStG)."""
    soli = config()["soli"]["wert"]
    if not kirchensteuer:
        return config()["abgeltungsteuer"]["wert"] * (1 + soli)
    est = 1 / (4 + kirchensteuer)
    return est * (1 + soli + kirchensteuer)


def basiszins() -> tuple[float, str, bool]:
    """(Wert, Jahr, geschätzt?) – neuester eingetragener Basiszins."""
    eintraege = config()["basiszins"]
    jahre = sorted(eintraege, reverse=True)
    neuestes = jahre[0]
    for j in jahre:
        if eintraege[j]["wert"] is not None:
            return eintraege[j]["wert"], j, j != neuestes
    return 0.0, "-", True


def klasse_fuer_mix(mix: dict[str, float]) -> str:
    aktien = mix.get("aktien", 0)
    if mix.get("gold", 0) == 1:
        return "gold_physisch"
    if aktien >= 0.51:
        return "aktien_etf"
    if aktien >= 0.25:
        return "misch"
    if mix.get("anleihen", 0) > 0:
        return "anleihen_etf"
    return "sonstiges"


def nach_steuern(
    end_nominal: float,
    eingezahlt: float,
    jahre: int,
    klasse: str,
    verlauf: list[dict] | None = None,
    verheiratet: bool = False,
    kirchensteuer: float | None = None,
    steuerfreier_anteil: float = 0.0,
    pausch_faktor: float = 1.0,
) -> dict:
    """Steuer bei Verkauf am Ende. `verlauf` = Liste je Jahr {anfang, einzahlung, ende}.

    steuerfreier_anteil: Anteil des Depots, der steuerfrei ist (z. B. Gold im Mix).
    """
    if klasse not in KLASSEN:
        raise ValueError(f"Unbekannte Steuerklasse: {klasse}")
    cfg = config()
    satz = steuersatz(kirchensteuer)
    pausch = cfg["sparerpauschbetrag"]["zusammen" if verheiratet else "einzeln"] * pausch_faktor
    gewinn = end_nominal - eingezahlt
    hinweise = [f"Steuersatz {satz:.4%} ({'mit' if kirchensteuer else 'ohne'} Kirchensteuer)."]
    ergebnis = {"steuer": 0.0, "netto": end_nominal, "gewinn": gewinn, "satz": satz,
                "teilfreistellung": 0.0, "vorabpauschale_summe": 0.0, "hinweise": hinweise}

    if klasse == "immobilie_privat":
        frist = cfg["spekulationsfrist_immobilie_jahre"]["wert"]
        if jahre > frist:
            hinweise.append(f"Verkauf nach mehr als {frist} Jahren steuerfrei (§ 23 EStG). Mieteinnahmen sind hier nicht berücksichtigt.")
            return ergebnis
        steuer = max(0.0, gewinn) * satz
        hinweise.append("Verkauf innerhalb von 10 Jahren: persönlicher Steuersatz – hier vereinfacht mit Abgeltungsteuersatz.")
        ergebnis.update(steuer=steuer, netto=end_nominal - steuer)
        return ergebnis

    if klasse in ("gold_physisch", "krypto_direkt"):
        if jahre >= cfg["haltefrist_steuerfrei_jahre"]["wert"]:
            hinweise.append("Steuerfrei nach mehr als 1 Jahr Haltedauer (§ 23 EStG).")
            return ergebnis
        steuer = max(0.0, gewinn) * satz  # privates Veräußerungsgeschäft, vereinfachter Satz
        hinweise.append("Unter 1 Jahr: persönlicher Einkommensteuersatz gilt – hier vereinfacht mit Abgeltungsteuersatz.")
        ergebnis.update(steuer=steuer, netto=end_nominal - steuer)
        return ergebnis

    steuerpflichtig = 1 - steuerfreier_anteil
    if steuerfreier_anteil:
        hinweise.append(f"{steuerfreier_anteil:.0%} des Depots (z. B. Gold) steuerfrei gerechnet.")

    if klasse == "zinsen":
        steuer = 0.0
        for j in verlauf or []:
            zinsen = (j["ende"] - j["anfang"] - j["einzahlung"]) * steuerpflichtig
            steuer += max(0.0, zinsen - pausch) * satz
        if not verlauf:
            steuer = max(0.0, gewinn * steuerpflichtig - pausch * jahre) * satz
        hinweise.append("Zinsen werden jährlich besteuert; Pauschbetrag jährlich angerechnet.")
        ergebnis.update(steuer=steuer, netto=end_nominal - steuer)
        return ergebnis

    tf = cfg["teilfreistellung"].get(klasse, 0.0)
    bz, bz_jahr, bz_geschaetzt = basiszins()
    faktor = cfg["vorabpauschale_faktor"]["wert"]
    steuer_jaehrlich, vp_summe = 0.0, 0.0
    for j in verlauf or []:
        zuwachs = j["ende"] - j["anfang"] - j["einzahlung"]
        vp = max(0.0, min(j["anfang"] * bz * faktor, zuwachs)) * steuerpflichtig
        vp_summe += vp
        steuer_jaehrlich += max(0.0, vp * (1 - tf) - pausch) * satz
    steuer_ende = max(0.0, (gewinn * steuerpflichtig - vp_summe) * (1 - tf) - pausch) * satz
    steuer = steuer_jaehrlich + steuer_ende
    hinweise.append(f"Teilfreistellung {tf:.0%} ({KLASSEN[klasse]}).")
    hinweise.append(
        f"Vorabpauschale mit Basiszins {bz:.2%} ({bz_jahr}"
        + (", neuerer Wert fehlt – geschätzt" if bz_geschaetzt else "")
        + ") für alle Jahre angesetzt."
    )
    ergebnis.update(steuer=steuer, netto=end_nominal - steuer, teilfreistellung=tf,
                    vorabpauschale_summe=vp_summe)
    return ergebnis


def nach_steuern_mix(end_nominal: float, eingezahlt: float, jahre: int, verlauf: list[dict] | None,
                     anteile: dict[str, float], verheiratet: bool = False, kirchensteuer: float | None = None) -> dict:
    """Steuer für ein gemischtes Depot: je Steuerklasse anteilig gerechnet, Pauschbetrag anteilig verteilt.

    anteile: {steuerklasse: gewicht}, Summe 1. Vereinfachung: alle Teile wachsen gleich schnell.
    """
    summe = sum(anteile.values()) or 1
    steuer, hinweise, teile = 0.0, [], []
    for klasse, w in anteile.items():
        f = w / summe
        teil_verlauf = [{k: v * f for k, v in j.items()} for j in (verlauf or [])]
        r = nach_steuern(end_nominal * f, eingezahlt * f, jahre, klasse, teil_verlauf, verheiratet, kirchensteuer, pausch_faktor=f)
        steuer += r["steuer"]
        teile.append({"klasse": klasse, "name": KLASSEN[klasse], "anteil": f, "steuer": r["steuer"]})
        hinweise += [h for h in r["hinweise"] if h not in hinweise]
    hinweise.append("Vereinfachung: alle Teile des Depots wachsen gleich schnell; Pauschbetrag anteilig verteilt.")
    return {"steuer": steuer, "netto": end_nominal - steuer, "teile": teile, "hinweise": hinweise}
