import json
from datetime import date, datetime, timedelta

import pytest

from app import entwurf, faktencheck, links, products

HEUTE = date.today().isoformat()
NEWS = f"""<?xml version="1.0"?><rss><channel>
<item><title>EZB senkt Leitzins</title><link>https://n/a</link><pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item>
<item><title>EZB senkt Zinsen um 0,25 Punkte</title><link>https://n/b</link><pubDate>Mon, 01 Jan 2024 11:00:00 GMT</pubDate><source url="https://www.handelsblatt.com">Handelsblatt</source></item>
</channel></rss>"""


def news(url, params=None, headers=None):
    return NEWS


def kurs_fetch(t, s):
    return [((date.today() - timedelta(days=i)).isoformat(), 100.0 + i) for i in range(10, -1, -1)]


# ---------- Feste Regeln ----------

def test_regeln_eine_quelle_ist_verfrueht():
    info = {"quellen": 1, "alle_jung": False}
    assert faktencheck.regeln_anwenden({"status": "bestaetigt", "art": "ereignis"}, info, False)["status"] == "verfrueht"
    info2 = {"quellen": 3, "alle_jung": True}
    assert faktencheck.regeln_anwenden({"status": "bestaetigt", "art": "ereignis"}, info2, False)["status"] == "verfrueht"
    assert faktencheck.regeln_anwenden({"status": "bestaetigt", "art": "zahl"}, {"quellen": 0, "alle_jung": False}, True)["status"] == "bestaetigt"
    assert faktencheck.regeln_anwenden({"status": "bestaetigt", "art": "prognose"}, {"quellen": 5, "alle_jung": False}, False)["status"] == "meinung"


def test_ampel():
    assert faktencheck.ampel([{"status": "bestaetigt"}], [{"status": "bestaetigt"}], True) == "gruen"
    assert faktencheck.ampel([{"status": "bestaetigt"}], [{"status": "verfrueht"}], True) == "gelb"
    assert faktencheck.ampel([{"status": "widerlegt"}], [], True) == "rot"
    assert faktencheck.ampel([{"status": "bestaetigt"}], [], False) == "gelb"


def test_check_lauf_und_freigabe(conn, user, user2):
    e = entwurf.hinzufuegen(conn, user, {"asset_id": "msci_world", "anteil": 100, "warum": "Die EZB hat die Zinsen gesenkt."})
    fid = faktencheck.start(conn, user, {"art": "entwurf", "id": e["id"]})

    def chat(c, rolle, msgs):
        assert rolle == "faktencheck"
        if "Ziehe aus dem Material" in msgs[0]["content"]:
            return json.dumps({"behauptungen": [{"aussage": "Die EZB hat die Zinsen gesenkt", "art": "ereignis", "suchbegriff": "EZB Zinsen"},
                                                {"aussage": "Aktien steigen 2027", "art": "prognose", "suchbegriff": ""}]}), "f", "m"
        return json.dumps({"urteile": [{"nr": 1, "status": "bestaetigt", "begruendung": "Reuters, Handelsblatt"}, {"nr": 2, "status": "bestaetigt"}]}), "f", "m"

    faktencheck.run(conn, fid, chat, news, kurs_fetch)
    r = faktencheck.get(conn, user, fid)
    assert r["status"] == "fertig"
    b = r["ergebnis"]["behauptungen"]
    assert b[0]["status"] == "bestaetigt" and len(b[0]["treffer"]) == 2
    assert b[1]["status"] == "meinung"
    assert any(x["pruefung"].startswith("Kurs") and x["status"] == "bestaetigt" for x in r["ergebnis"]["feste"])
    assert faktencheck.get(conn, user2, fid) is None
    f = faktencheck.freigabe(conn, user, fid, False)
    assert f["ampel"] in ("gruen", "gelb")
    with pytest.raises(ValueError, match="zuerst"):
        faktencheck.freigabe(conn, user, None, False)


def test_check_rot_braucht_bestaetigung(conn, user):
    fid = faktencheck.start(conn, user, {"art": "plan", "positionen": [{"name": "Kaputt", "ticker": "GIBTSNICHT"}]})
    faktencheck.run(conn, fid, lambda *a: (_ for _ in ()).throw(RuntimeError("kein Modell")), news, lambda t, s: [])
    r = faktencheck.get(conn, user, fid)
    assert r["ergebnis"]["ampel"] == "rot"
    with pytest.raises(ValueError, match="Rot"):
        faktencheck.freigabe(conn, user, fid, False)
    assert faktencheck.freigabe(conn, user, fid, True)["trotzdem"] is True


# ---------- Links ----------

def test_link_sicherheit():
    with pytest.raises(links.LinkFehler):
        links.pruefe_url("file:///etc/passwd")
    with pytest.raises(links.LinkFehler):
        links.pruefe_url("http://localhost:8001/api")
    with pytest.raises(links.LinkFehler):
        links.pruefe_url("http://intern.example/x", dns=lambda h: False)
    assert links.pruefe_url("https://www.example.com/a", dns=lambda h: True) == "https://www.example.com/a"
    assert not links._oeffentlich("127.0.0.1")


def test_youtube_und_html():
    assert links.youtube_id("https://www.youtube.com/watch?v=abc123XYZ_9&t=10") == "abc123XYZ_9"
    assert links.youtube_id("https://youtu.be/xyz987") == "xyz987"
    assert links.youtube_id("https://www.youtube.com/shorts/kurz1") == "kurz1"
    assert links.youtube_id("https://example.com/watch?v=1") is None
    t = links.text_aus_html("<html><title>Gold &amp; Zinsen</title><script>x()</script><p>" + "Der Goldpreis hängt am Realzins und an Notenbankkäufen. " * 2 + "</p><nav><p>Menü Menü Menü Menü Menü Menü Menü Menü Menü</p></nav></html>")
    assert t["titel"] == "Gold & Zinsen" and "Realzins" in t["text"] and "Menü" not in t["text"]
    assert links.finde_urls("Schau mal https://a.de/x, und https://b.de/y!") == ["https://a.de/x", "https://b.de/y"]


def test_link_verstehen(conn, user):
    leser = lambda url: {"url": url, "art": "video", "titel": "Warum Silber explodiert", "autor": "Kanal", "text": "Silber wird knapp …", "transkript": True}  # noqa: E731
    def chat(c, rolle, msgs):
        assert "fremder Text" in msgs[1]["content"]
        return json.dumps({"titel": "Warum Silber explodiert", "kernaussagen": ["Angebotsdefizit"], "idee": "Silber kaufen", "einordnung": "Influencer, werblich", "zu_pruefen": ["Defizit"]}), "f", "m"
    d = links.verstehen(conn, user, "https://youtu.be/abc", chat, leser)
    assert d["idee"] == "Silber kaufen" and d["transkript"] is True
    assert links.letzte(conn, user)["titel"] == "Warum Silber explodiert"


def test_berater_liest_link(conn, user):
    from app import berater
    cid = berater.anlegen(conn, user, "Idee", None, "Glossar: Silber")
    leser = lambda url: {"url": url, "art": "artikel", "titel": "Silber-Artikel", "autor": "", "text": "Text", "transkript": False}  # noqa: E731
    gesehen = {}
    def chat(c, rolle, msgs):
        if "fremder Text" in msgs[-1]["content"] or "Recherche-Analyst" in msgs[0]["content"]:
            return json.dumps({"kernaussagen": ["Silber knapp"], "idee": "Silber"}), "f", "m"
        gesehen["kontext"] = msgs[1]["content"]
        if "Portfolio-Berater" in msgs[0]["content"]:
            return json.dumps({"antwort": "Verstanden"}), "f", "m"
        return json.dumps({"kommentar": "ok"}), "f", "m"
    berater.antworten(conn, cid, "Was hältst du davon? https://example.com/silber", chat, None, leser)
    ms = berater.nachrichten(conn, cid)
    assert [m["rolle"] for m in ms][:3] == ["nutzer", "system", "berater"]
    assert "Link verstanden" in ms[1]["inhalt"] and "Glossar: Silber" in gesehen["kontext"]


# ---------- Katalog: Prüfung, Ranking, Import ----------

YAHOO = json.dumps({"quotes": [{"symbol": "EUNL.L", "longname": "iShares Core MSCI World UCITS ETF", "exchange": "LSE"},
                               {"symbol": "EUNL.DE", "longname": "iShares Core MSCI World UCITS ETF USD (Acc)", "exchange": "GER"}]})
JUSTETF = "<h1>iShares Core MSCI World UCITS ETF</h1><div>Gesamtkostenquote (TER) 0,20% p.a.</div><div>Fondsgröße EUR 99.123 Mio.</div><div>Ertragsverwendung Thesaurierend</div><div>Fondsdomizil Irland</div>"


def kat_fetch(url, params=None):
    return YAHOO if "yahoo" in url else JUSTETF


def test_pruefen_und_ranking(conn):
    p = products.finde("IE00B4L5Y983")
    erg = products.pruefen(conn, p, kat_fetch)
    assert erg["geprueft"] and erg["ticker"] == "EUNL.DE"
    f = products.fakten(conn, "IE00B4L5Y983")
    assert float(f["ter"]["wert"]) == 0.2 and float(f["volumen_mio"]["wert"]) == 99123 and "justETF" in f["ter"]["quelle"]
    r = products.ranking(conn, "msci_world")
    assert r[0]["isin"] == "IE00B4L5Y983" and r[0]["score"] == 100
    assert all("kriterien" in x for x in r) and len(r) >= 8


def test_ticker_aufloesung_aus_fakten(conn):
    p = next(x for x in products.katalog() if not x["ticker"])
    products.setze_fakt(conn, p["isin"], "ticker", "TEST.DE", "Test")
    assert products.mit_status(conn, p)["ticker"] == "TEST.DE"


def test_import(conn, tmp_path, monkeypatch):
    monkeypatch.setenv("KOMPASS_PRODUKTE_EXTRA", str(tmp_path / "extra.json"))
    products.katalog.cache_clear()
    with pytest.raises(ValueError, match="ISIN"):
        products.importieren(conn, "QUATSCH", "msci_world", kat_fetch)
    with pytest.raises(ValueError, match="schon"):
        products.importieren(conn, "IE00B4L5Y983", "msci_world", kat_fetch)
    neu = products.importieren(conn, "IE00BZZZZZZ1", "msci_world", kat_fetch)
    assert neu["geprueft"] and products.finde("IE00BZZZZZZ1")["asset"] == "msci_world"
    with pytest.raises(ValueError, match="Keine Quelle"):
        products.importieren(conn, "IE00BYYYYYY2", "msci_world", lambda u, p=None: (_ for _ in ()).throw(ConnectionError()))
    monkeypatch.delenv("KOMPASS_PRODUKTE_EXTRA")
    products.katalog.cache_clear()


# ---------- Mehrere Entwürfe ----------

def test_mehrere_entwuerfe(conn, user, user2):
    a = entwurf.neu(conn, user, {"name": "Wachstum"})
    b = entwurf.neu(conn, user, {"name": "Sicherheit"})
    import time
    time.sleep(0.01)  # Zeitstempel in Millisekunden
    entwurf.hinzufuegen(conn, user, {"asset_id": "gold", "anteil": 30}, a["id"])
    assert [x["name"] for x in entwurf.liste(conn, user)][0] == "Wachstum"
    assert entwurf.get(conn, user, b["id"])["positionen"] == []
    with pytest.raises(LookupError):
        entwurf.get(conn, user2, a["id"])
    assert entwurf.loeschen(conn, user, b["id"]) and len(entwurf.liste(conn, user)) == 1


def test_metalle_vollstaendig_und_ohne_gedaechtniszahlen():
    import re
    from app import glossar
    d = glossar.daten()
    metalle = [a for a in d["assets"] if a.get("metall")]
    ids = {a["id"] for a in metalle}
    assert {"gold", "silber", "platin", "palladium", "kupfer", "lithium", "uran", "seltene_erden"} <= ids
    for a in metalle:
        m = a["metall"]
        assert set(m["wege"]) == {"physisch", "papier", "aktien"}, a["id"]
        assert all(w["geht"] in ("ja", "eingeschränkt", "nein") for w in m["wege"].values()), a["id"]
        assert m["ausmacht"] and m["einsatz"] and m["engpaesse"] and m["welcher_weg"], a["id"]
        # Regel 3: keine Zahlen aus dem Gedächtnis – in den Beschreibungen nur Jahreszahlen erlaubt
        text = " ".join(m["ausmacht"] + m["einsatz"] + m["gefragt_wenn"] + m["schwach_wenn"] + m["engpaesse"]
                        + [x for paar in m["welcher_weg"] for x in paar])
        rest = re.sub(r"\b(19|20)\d\d(er)?\b|CO₂|nach 1 Jahr", "", text)
        assert not re.search(r"\d", rest), (a["id"], re.findall(r".{20}\d.{10}", rest))
    # Wirkungsgefüge kennt Industriemetalle, jedes Metall verweist auf vorhandene Knoten
    knoten = {k["id"] for k in glossar.wirkung()["knoten"]}
    assert all(set(a["wirkung_knoten"]) <= knoten for a in metalle)
