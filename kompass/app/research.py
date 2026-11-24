"""Recherche auf Abruf: Fragen, Briefings, Analysen – nur aus vertrauenswürdigen Quellen.

Material: RSS-Feeds (tagesschau, DW, EZB), EZB-Datenportal (Zinsen, Inflation),
Bundestag DIP (Gesetzgebung). Das Modell antwortet nur aus diesem Material mit
Quellennummern. Jede Quelle wird mit URL und Abrufzeit gespeichert.
"""
import csv
import io
import json
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

import httpx

from . import config, llm, prompts
from .db import one, rows

QUELLEN = Path(__file__).resolve().parent.parent / "data" / "quellen.json"
BEREICHE = {"alles": "Alles", "geopolitik": "Geopolitik", "deutschland": "Deutschland & Gesetze",
            "wirtschaft": "Wirtschaft & Märkte", "geldpolitik": "Zinsen & Geldpolitik"}
MAX_QUELLEN = 25


def quellen() -> dict:
    return json.loads(QUELLEN.read_text(encoding="utf-8"))


def fetch_text(url: str, params: dict | None = None, headers: dict | None = None) -> str:
    r = httpx.get(url, params=params, headers={"User-Agent": "Kompass/1.0", **(headers or {})},
                  timeout=20, follow_redirects=True)
    r.raise_for_status()
    return r.text


def _text(el, *namen) -> str:
    for kind in el:
        tag = kind.tag.rsplit("}", 1)[-1]
        if tag in namen:
            if tag == "link" and kind.get("href"):
                return kind.get("href")
            return (kind.text or "").strip()
    return ""


def _datum(s: str) -> str:
    if not s:
        return ""
    try:
        return parsedate_to_datetime(s).date().isoformat()
    except (TypeError, ValueError):
        return s[:10]


def parse_feed(xml: str, quelle: str, bereich: str) -> list[dict]:
    """RSS 2.0, RDF und Atom."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    items = []
    for el in root.iter():
        if el.tag.rsplit("}", 1)[-1] not in ("item", "entry"):
            continue
        titel = _text(el, "title")
        if not titel:
            continue
        beschreibung = re.sub(r"<[^>]+>", " ", _text(el, "description", "summary", "content"))
        herkunft, domain = quelle, ""
        for kind in el:
            if kind.tag.rsplit("}", 1)[-1] == "source" and kind.get("url"):
                herkunft = (kind.text or "").strip() or quelle
                domain = re.sub(r"^www\.", "", re.sub(r"^https?://", "", kind.get("url")).split("/")[0])
        items.append({
            "titel": titel,
            "url": _text(el, "link"),
            "datum": _datum(_text(el, "pubDate", "date", "updated", "published")),
            "text": re.sub(r"\s+", " ", beschreibung).strip()[:500],
            "quelle": herkunft,
            "domain": domain,
            "bereich": bereich,
        })
    return items


GOOGLE_NEWS = "https://news.google.com/rss/search"


def suche(query: str, fetch=fetch_text) -> list[dict]:
    """Aktuelle Artikel zu einer Suchanfrage – nur von Quellen aus der Medienliste (data/medien.json)."""
    from .glossar import domains

    erlaubt = domains()
    xml = fetch(GOOGLE_NEWS, params={"q": query, "hl": "de", "gl": "DE", "ceid": "DE:de"})
    out = []
    for i in parse_feed(xml, "Nachrichtensuche", "suche"):
        if any(i["domain"] == d or i["domain"].endswith("." + d) for d in erlaubt):
            out.append(i)
    return out


def ezb_reihe(reihe: dict, fetch=fetch_text) -> dict | None:
    flow, key = reihe["key"].split("/", 1)
    txt = fetch(f"https://data-api.ecb.europa.eu/service/data/{flow}/{key}",
                params={"lastNObservations": "1", "format": "csvdata"})
    daten = list(csv.DictReader(io.StringIO(txt)))
    if not daten:
        return None
    d = daten[-1]
    return {
        "titel": f"{reihe['name']}: {d['OBS_VALUE']} {reihe['einheit']} (Stand {d['TIME_PERIOD']})",
        "url": f"https://data.ecb.europa.eu/data/datasets/{flow}/{flow}.{key}",
        "datum": d["TIME_PERIOD"], "text": "", "quelle": "EZB Data Portal", "bereich": "geldpolitik",
    }


def dip_vorgaenge(fetch=fetch_text, tage: int = 30) -> list[dict]:
    key = config.key("DIP_API_KEY")
    if not key:
        return []
    q = quellen()["dip"]
    txt = fetch(q["url"], params={"f.datum.start": (date.today() - timedelta(days=tage)).isoformat(),
                                  "f.vorgangstyp": "Gesetzgebung", "format": "json"},
                headers={"Authorization": f"ApiKey {key}"})
    out = []
    for d in json.loads(txt).get("documents", [])[:40]:
        out.append({
            "titel": f"{d.get('titel', '')} ({d.get('beratungsstand', 'Stand unbekannt')})",
            "url": f"https://dip.bundestag.de/vorgang/-/{d.get('id')}",
            "datum": d.get("datum", ""), "text": (d.get("abstract") or "")[:500],
            "quelle": q["name"], "bereich": "deutschland",
        })
    return out


def collect(kind: str, query: str, bereich: str = "alles", fetch=fetch_text) -> tuple[list[dict], list[str]]:
    """(Material, Fehlerliste). Pro Quelle unabhängig – eine kaputte Quelle stoppt nichts."""
    q = quellen()
    items, fehler = [], []
    for f in q["feeds"]:
        if bereich != "alles" and f["bereich"] != bereich:
            continue
        try:
            items += parse_feed(fetch(f["url"]), f["name"], f["bereich"])
        except Exception as e:
            fehler.append(f"{f['name']}: {type(e).__name__}")
    if bereich in ("alles", "geldpolitik", "wirtschaft"):
        for r in q["ezb_reihen"]:
            try:
                d = ezb_reihe(r, fetch)
                if d:
                    items.append(d)
            except Exception as e:
                fehler.append(f"{r['name']}: {type(e).__name__}")
    if kind != "briefing" and query.strip():
        try:
            items += suche(query, fetch)
        except Exception as e:
            fehler.append(f"Nachrichtensuche: {type(e).__name__}")
    if bereich in ("alles", "deutschland"):
        try:
            items += dip_vorgaenge(fetch)
        except Exception as e:
            fehler.append(f"Bundestag DIP: {type(e).__name__}")
    return auswahl(items, kind, query), fehler


def auswahl(items: list[dict], kind: str, query: str) -> list[dict]:
    """Briefing: neueste. Frage/Analyse: nach Stichworten, Kennzahlen (EZB) immer dabei."""
    fest = [i for i in items if i["quelle"] == "EZB Data Portal"]
    rest = [i for i in items if i["quelle"] != "EZB Data Portal"]
    rest.sort(key=lambda i: i["datum"] or "", reverse=True)
    if kind != "briefing":
        woerter = [w for w in re.findall(r"\w+", query.lower()) if len(w) > 3]
        def score(i):
            t = f"{i['titel']} {i['text']}".lower()
            return sum(1 for w in woerter if w[:6] in t)
        treffer = [i for i in rest if score(i) > 0 or i["bereich"] == "suche"]
        treffer.sort(key=lambda i: (i["bereich"] == "suche", score(i)), reverse=True)
        rest = treffer + [i for i in rest if i not in treffer][:5]
    return (fest + rest)[:MAX_QUELLEN]


def material_text(items: list[dict]) -> str:
    return "\n".join(
        f"[{n}] {i['titel']} — {i['quelle']}, {i['datum']}. {i['text']}" for n, i in enumerate(items, 1)
    )


def start(conn, user_id: int, kind: str, query: str) -> int:
    if kind not in ("frage", "briefing", "analyse"):
        raise ValueError("Art muss frage, briefing oder analyse sein")
    if not query.strip():
        raise ValueError("Bitte eine Frage oder ein Thema angeben")
    cur = conn.execute("INSERT INTO research (user_id, kind, query) VALUES (?, ?, ?)", (user_id, kind, query.strip()))
    conn.commit()
    return cur.lastrowid


def run(conn, research_id: int, bereich: str = "alles", chat_fn=llm.chat, fetch=fetch_text) -> None:
    r = one(conn, "SELECT * FROM research WHERE id = ?", (research_id,))
    try:
        items, fehler = collect(r["kind"], r["query"], bereich, fetch)
        abruf = datetime.now().isoformat(timespec="minutes")
        for i in items:
            i["abgerufen"] = abruf
        if not items:
            antwort = "Keine Quelle war erreichbar oder lieferte passendes Material. Es gibt daher keine belegte Antwort."
            if fehler:
                antwort += " Fehler: " + "; ".join(fehler)
            conn.execute("UPDATE research SET answer = ?, status = 'fertig' WHERE id = ?", (antwort, research_id))
            conn.commit()
            return
        auftrag = {
            "frage": f"Beantworte die Frage: {r['query']}",
            "briefing": f"Erstelle ein Briefing zum Thema „{r['query']}“: die wichtigsten Entwicklungen, jeweils mit Bedeutung für Anleger.",
            "analyse": f"Analysiere gründlich: {r['query']}. Gliederung: Lage, Treiber, Szenarien, mögliche Folgen für Anlageklassen.",
        }[r["kind"]]
        text, anbieter, modell = chat_fn(conn, "recherche", [
            {"role": "system", "content": prompts.RECHERCHE},
            {"role": "user", "content": f"{auftrag}\n\nHeute ist {date.today().isoformat()}.\n\nMATERIAL:\n{material_text(items)}"},
        ])
        if fehler:
            text += "\n\n_Nicht erreichbar: " + "; ".join(fehler) + "_"
        conn.execute(
            "UPDATE research SET answer = ?, sources_json = ?, provider = ?, model = ?, status = 'fertig' WHERE id = ?",
            (text, json.dumps(items, ensure_ascii=False), anbieter, modell, research_id),
        )
    except Exception as e:
        conn.execute("UPDATE research SET answer = ?, status = 'fehler' WHERE id = ?", (f"Fehler: {e}", research_id))
    conn.commit()


def get(conn, user_id: int, research_id: int) -> dict | None:
    r = one(conn, "SELECT * FROM research WHERE id = ? AND user_id = ?", (research_id, user_id))
    if r:
        r["quellen"] = json.loads(r.pop("sources_json"))
    return r


def liste(conn, user_id: int) -> list[dict]:
    return rows(conn, "SELECT id, kind, query, status, created_at FROM research WHERE user_id = ? ORDER BY id DESC LIMIT 100",
                (user_id,))
