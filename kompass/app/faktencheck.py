"""Sicherheitscheck vor dem endgültigen Speichern einer Strategie.

Prüft, ob die Grundlagen einer Entscheidung mit aktuellen, vertrauenswürdigen Daten übereinstimmen:
1. Feste Prüfungen (ohne KI): aktuelle Kurse je Produkt, Prüfstatus der Produkte, Live-Indikatoren.
2. Behauptungen aus Council-Ergebnis, Gesprächen und Begründung werden (per KI) herausgezogen und gegen
   Treffer aus der Medienliste (25 Quellen) und amtliche Daten gehalten.
Feste Regeln stehen über dem Modell: Ohne zwei unabhängige Quellen oder amtliche Daten gibt es kein
„bestätigt“, Meldungen jünger als 48 Stunden gelten als „verfrüht“, Prognosen sind nie Fakten.
"""
import json
from datetime import date, datetime, timedelta

from . import indikatoren, llm, market, products, prompts, research
from .council import parse_json
from .db import one, rows

STATUS = ("bestaetigt", "widerlegt", "verfrueht", "veraltet", "nicht_pruefbar", "meinung")
MAX_BEHAUPTUNGEN = 8


def start(conn, user_id: int, quelle: dict) -> int:
    if quelle.get("art") not in ("entwurf", "session", "plan"):
        raise ValueError("Unbekannte Quelle für den Sicherheitscheck.")
    cur = conn.execute("INSERT INTO faktenchecks (user_id, quelle_json) VALUES (?, ?)", (user_id, json.dumps(quelle, ensure_ascii=False)))
    conn.commit()
    return cur.lastrowid


def get(conn, user_id: int, fid: int) -> dict | None:
    r = one(conn, "SELECT * FROM faktenchecks WHERE id = ? AND user_id = ?", (fid, user_id))
    if r:
        r["quelle"] = json.loads(r.pop("quelle_json"))
        r["ergebnis"] = json.loads(r.pop("ergebnis_json")) if r["ergebnis_json"] else None
    return r


def _material(conn, user_id: int, q: dict) -> tuple[str, list[dict]]:
    """Text mit den Aussagen, auf denen die Strategie beruht, und die Positionen."""
    from . import council, entwurf

    teile, positionen = [], q.get("positionen") or []
    if q.get("session_id"):
        s = council.session_for(conn, user_id, int(q["session_id"]))
        if s and s["result_json"]:
            r = json.loads(s["result_json"])
            syn = r.get("synthese", {})
            teile.append("COUNCIL-ERGEBNIS: " + " ".join(filter(None, [syn.get("zusammenfassung"), syn.get("richtung"), "; ".join(syn.get("risiken", []))])))
            for m in council.messages_for(conn, s["id"]):
                if m["phase"] == "fach" and m["data"]:
                    teile.append(f"{m['titel']}: " + "; ".join(map(str, m["data"].get("argumente", []))))
    if q.get("art") == "entwurf" and q.get("id"):
        e = entwurf.get(conn, user_id, int(q["id"]))
        positionen = positionen or e["positionen"]
        teile += [f"Begründung {p['name']}: {p['warum']}" for p in e["positionen"] if p.get("warum")]
        if e.get("beschreibung"):
            teile.append("Beschreibung: " + e["beschreibung"])
    # Letzte Antworten des Portfolio-Councils dieses Nutzers
    for m in rows(conn, "SELECT n.inhalt FROM berater_nachrichten n JOIN berater_chats c ON c.id = n.chat_id "
                        "WHERE c.user_id = ? AND n.rolle IN ('berater', 'kritiker') ORDER BY n.id DESC LIMIT 6", (user_id,)):
        if m["inhalt"]:
            teile.append("Gespräch: " + m["inhalt"][:600])
    if q.get("text"):
        teile.append("Begründung: " + q["text"])
    return "\n".join(teile)[:9000], positionen


def feste_pruefungen(conn, positionen: list[dict], fetch_fn=None, heute: date | None = None) -> list[dict]:
    """Prüfungen ohne KI: Kursdaten aktuell? Produkt bestätigt? Gibt [{pruefung, status, text}] zurück."""
    heute = heute or date.today()
    out = []
    for p in positionen:
        kat = products.finde(p.get("isin") or p.get("ticker") or "")
        ticker = p.get("ticker") or (products.mit_status(conn, kat).get("ticker") if kat else "")
        name = p.get("name") or ticker
        if not ticker:
            out.append({"pruefung": f"Kurs {name}", "status": "nicht_pruefbar", "text": "Kein Ticker – aktueller Kurs nicht prüfbar."})
        else:
            k = market.last(conn, ticker, fetch_fn)
            if not k:
                out.append({"pruefung": f"Kurs {name}", "status": "widerlegt", "text": f"Für {ticker} gibt es keinen aktuellen Kurs – Ticker falsch oder Produkt nicht handelbar?"})
            elif (heute - date.fromisoformat(k[0])).days > 7:
                out.append({"pruefung": f"Kurs {name}", "status": "veraltet", "text": f"Letzter Kurs vom {k[0]} – älter als eine Woche."})
            else:
                out.append({"pruefung": f"Kurs {name}", "status": "bestaetigt", "text": f"Aktueller Kurs {k[1]:.2f} vom {k[0]} (Yahoo Finance)."})
        if kat:
            st = products.mit_status(conn, kat)
            ok = st.get("geprueft") is True
            out.append({"pruefung": f"Produktdaten {name}", "status": "bestaetigt" if ok else "nicht_pruefbar",
                        "text": f"ISIN {kat['isin']} bestätigt ({st.get('geprueft_quelle', '')})." if ok else f"ISIN {kat.get('isin') or '–'} noch nicht gegen Yahoo/justETF geprüft."})
    return out


def _treffer_bewerten(treffer: list[dict], jetzt: datetime) -> dict:
    """Wie viele unabhängige Quellen, wie alt? Grundlage für die festen Regeln."""
    quellen = {t.get("domain") or t.get("quelle") for t in treffer}
    daten = []
    for t in treffer:
        try:
            daten.append(datetime.fromisoformat(t["datum"][:10]))
        except (ValueError, TypeError, KeyError):
            pass
    aelteste = min(daten) if daten else None
    return {"quellen": len(quellen), "alle_jung": bool(daten) and all((jetzt - d) < timedelta(hours=48) for d in daten),
            "aelteste": aelteste.date().isoformat() if aelteste else None}


def regeln_anwenden(b: dict, info: dict, amtlich: bool) -> dict:
    """Feste Regeln über dem Modellurteil."""
    st = b.get("status") if b.get("status") in STATUS else "nicht_pruefbar"
    if b.get("art") in ("prognose", "meinung"):
        st = "meinung"
    elif st == "bestaetigt" and not amtlich:
        if info["quellen"] < 2:
            st, b["regel"] = "verfrueht", "Nur eine Quelle – noch kein Fakt."
        elif info["alle_jung"]:
            st, b["regel"] = "verfrueht", "Alle Meldungen jünger als 48 Stunden – abwarten."
    b["status"] = st
    return b


def ampel(feste: list[dict], behauptungen: list[dict], ki_ok: bool) -> str:
    alle = [x["status"] for x in feste] + [x["status"] for x in behauptungen]
    if "widerlegt" in alle:
        return "rot"
    if not ki_ok or any(s in ("verfrueht", "veraltet", "nicht_pruefbar") for s in alle):
        return "gelb"
    return "gruen"


def run(conn, fid: int, chat_fn=llm.chat, fetch=research.fetch_text, kurs_fetch=None, ind_fetch=None) -> None:
    r = one(conn, "SELECT * FROM faktenchecks WHERE id = ?", (fid,))
    q = json.loads(r["quelle_json"])
    jetzt = datetime.now()
    erg = {"zeitpunkt": jetzt.isoformat(timespec="seconds"), "feste": [], "behauptungen": [], "indikatoren": {}, "hinweise": []}
    try:
        text, positionen = _material(conn, r["user_id"], q)
        erg["feste"] = feste_pruefungen(conn, positionen, kurs_fetch)
        ind = indikatoren.aktuell(conn, fetch=ind_fetch) if ind_fetch else indikatoren.aktuell(conn)
        erg["indikatoren"] = {k: {"name": v["name"], "wert": v["wert"], "datum": v["datum"], "live": v["live"], "quelle": v["quelle"]} for k, v in ind.items()}
        ki_ok = True
        if text.strip():
            try:
                d = _frage(conn, chat_fn, prompts.FAKTEN_EXTRAHIEREN, f"MATERIAL:\n{text}", "behauptungen")
                kandidaten = [b for b in d.get("behauptungen", []) if isinstance(b, dict) and b.get("aussage")][:MAX_BEHAUPTUNGEN]
                for b in kandidaten:
                    b["treffer"] = []
                    if b.get("art") not in ("prognose", "meinung") and b.get("suchbegriff"):
                        try:
                            b["treffer"] = [{k: t.get(k) for k in ("titel", "quelle", "domain", "datum", "url")} for t in research.suche(b["suchbegriff"], fetch)[:6]]
                        except Exception:
                            erg["hinweise"].append(f"Nachrichtensuche für „{b['suchbegriff']}“ nicht erreichbar.")
                ind_text = "\n".join(f"- {v['name']}: {v['wert']:.2f} (Stand {v['datum']}{'' if v['live'] else ', nicht live'})" for v in ind.values())
                urteil = _frage(conn, chat_fn, prompts.FAKTEN_PRUEFEN,
                                f"HEUTE: {jetzt.date().isoformat()}\nAMTLICHE/LIVE-DATEN:\n{ind_text}\n\nBEHAUPTUNGEN MIT TREFFERN:\n{json.dumps(kandidaten, ensure_ascii=False)}",
                                "urteile")
                urteile = {u.get("nr"): u for u in urteil.get("urteile", []) if isinstance(u, dict)}
                for i, b in enumerate(kandidaten, 1):
                    u = urteile.get(i, {})
                    b.update({"status": u.get("status", "nicht_pruefbar"), "begruendung": u.get("begruendung", ""), "amtlich": bool(u.get("amtlich"))})
                    erg["behauptungen"].append(regeln_anwenden(b, _treffer_bewerten(b["treffer"], jetzt), b["amtlich"]))
            except Exception as ex:
                ki_ok = False
                erg["hinweise"].append(f"KI-Prüfung nicht möglich: {str(ex)[:160]}. Nur feste Prüfungen gelaufen.")
        else:
            erg["hinweise"].append("Keine Begründungstexte gefunden – nur feste Prüfungen gelaufen.")
        erg["ampel"] = ampel(erg["feste"], erg["behauptungen"], ki_ok)
        status = "fertig"
    except Exception as ex:
        erg["hinweise"].append(f"Fehler: {ex}")
        erg["ampel"] = "gelb"
        status = "fehler"
    conn.execute("UPDATE faktenchecks SET ergebnis_json = ?, status = ? WHERE id = ?", (json.dumps(erg, ensure_ascii=False), status, fid))
    conn.commit()


def _frage(conn, chat_fn, system: str, inhalt: str, pflicht: str) -> dict:
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": inhalt}]
    text, _, _ = chat_fn(conn, "faktencheck", msgs)
    d = parse_json(text)
    if d is None or pflicht not in d:
        text, _, _ = chat_fn(conn, "faktencheck", msgs + [{"role": "assistant", "content": text},
                                                         {"role": "user", "content": "Antworte ausschließlich mit dem JSON im verlangten Schema."}])
        d = parse_json(text)
    if d is None or pflicht not in d:
        raise ValueError("Modell lieferte kein gültiges Ergebnis")
    return d


def freigabe(conn, user_id: int, check_id: int | None, trotzdem: bool) -> dict:
    """Darf gespeichert werden? Gibt die Kurzfassung des Checks für das Einfrieren zurück."""
    if check_id is None:
        raise ValueError("Bitte zuerst den Sicherheitscheck ausführen.")
    c = get(conn, user_id, check_id)
    if not c or c["status"] == "laeuft":
        raise ValueError("Der Sicherheitscheck ist noch nicht fertig.")
    if (datetime.now() - datetime.fromisoformat(c["ergebnis"]["zeitpunkt"])) > timedelta(hours=24):
        raise ValueError("Der Sicherheitscheck ist älter als 24 Stunden – bitte neu ausführen.")
    if c["ergebnis"]["ampel"] == "rot" and not trotzdem:
        raise ValueError("Der Sicherheitscheck zeigt Rot. Bestätige ausdrücklich, dass du trotzdem speichern willst.")
    return {"id": c["id"], "ampel": c["ergebnis"]["ampel"], "zeitpunkt": c["ergebnis"]["zeitpunkt"], "trotzdem": trotzdem,
            "behauptungen": [{k: b.get(k) for k in ("aussage", "status", "begruendung")} for b in c["ergebnis"]["behauptungen"]],
            "feste": c["ergebnis"]["feste"]}
