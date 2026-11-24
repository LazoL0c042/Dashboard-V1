"""Kompass – HTTP-API und Auslieferung der Web-App."""
import json
import threading
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import auth, berater, calculator, config, council, db, entwurf, glossar, llm, plans, portfolios, products, profile, research, scenarios, taxes

STATIC = Path(__file__).resolve().parent.parent / "static"
COOKIE = "kompass_session"


# ---------- Eingabemodelle ----------

class Login(BaseModel):
    name: str
    pw: str


class Register(Login):
    invite: str


class Passwort(BaseModel):
    alt: str
    neu: str


class Fakt(BaseModel):
    key: str
    value: str
    status: str = "angegeben"


class Bestaetigen(BaseModel):
    value: str | None = None


class NeueSitzung(BaseModel):
    idea: str
    research_ids: list[int] = []


class Antwort(BaseModel):
    text: str


class Produkt(BaseModel):
    ticker: str
    isin: str = ""
    name: str = ""
    anteil: float = 1.0


class NeuerPlan(BaseModel):
    session_id: int | None = None
    titel: str
    was: str = ""
    wofuer: str = ""
    horizont_jahre: float = 0
    warum: str = ""
    kriterien: str = ""
    einmalbetrag: float = 0
    sparrate: float = 0
    zielbetrag: float | None = None
    startdatum: str | None = None
    produkte: list[Produkt]


class Notiz(BaseModel):
    text: str


class Recherche(BaseModel):
    kind: str
    query: str
    bereich: str = "alles"


class Steuern(BaseModel):
    aktiv: bool = False
    verheiratet: bool = False
    kirchensteuer: float | None = None
    klasse: str | None = None


class Rechner(BaseModel):
    start: float = Field(0, ge=0)
    monthly: float = Field(0, ge=0)
    years: int = Field(20, ge=1, le=100)
    mix: dict[str, float]
    ter: float = Field(0.2, ge=0, le=5)  # in Prozent
    increase: float = Field(0, ge=0, le=20)  # in Prozent
    custom_rate: float | None = None  # in Prozent
    steuern: Steuern = Steuern()
    steuer_anteile: dict[str, float] | None = None  # {steuerklasse: gewicht} für gemischte Depots


class Modelle(BaseModel):
    rollen: dict[str, list[list[str]]]


class Position(BaseModel):
    ticker: str
    isin: str = ""
    id: str = ""
    name: str = ""
    anteil: float = 0
    klassen: dict[str, float] = {}


class PortfolioEingabe(BaseModel):
    name: str
    beschreibung: str = ""
    startdatum: str
    einmalbetrag: float = 0
    sparrate: float = 0
    positionen: list[Position]


class SzenarioKI(BaseModel):
    szenario: str | None = None
    freitext: str = ""
    titel: str = ""
    depotwert: float = 10000
    positionen: list[dict]
    ergebnis_kurz: dict = {}


class SzenarioNotiz(BaseModel):
    inhalt: dict


class Suche(BaseModel):
    query: str


class EntwurfPosition(BaseModel):
    asset_id: str | None = None
    id: str | None = None
    isin: str = ""
    ticker: str = ""
    name: str = ""
    anteil: float = 10
    klassen: dict[str, float] = {}


class BeraterStart(BaseModel):
    text: str


class SteuerFall(BaseModel):
    end_nominal: float
    eingezahlt: float
    verlauf: list[dict] = []


class SteuernMix(BaseModel):
    jahre: int = Field(ge=1, le=100)
    faelle: list[SteuerFall]
    anteile: dict[str, float]
    verheiratet: bool = False
    kirchensteuer: float | None = None


class ProduktFakt(BaseModel):
    key: str
    value: str
    quelle: str


# ---------- App ----------

def create_app(db_path: str | None = None, runner=None) -> FastAPI:
    app = FastAPI(title="Kompass", docs_url=None, redoc_url=None)
    db_path = db_path or config.DB_PATH
    db.connect(db_path).close()  # Schema anlegen

    def run_bg(fn, *args):
        """Lange Aufgaben (Modelle) im Hintergrund, jeweils mit eigener DB-Verbindung."""
        def target():
            c = db.connect(db_path)
            try:
                fn(c, *args)
            finally:
                c.close()
        if runner:
            runner(target)
        else:
            threading.Thread(target=target, daemon=True).start()

    def get_conn():
        c = db.connect(db_path)
        try:
            yield c
        finally:
            c.close()

    def get_user(request: Request, c=Depends(get_conn)):
        u = auth.user_for_token(c, request.cookies.get(COOKIE))
        if not u:
            raise HTTPException(401, "Bitte anmelden")
        return u

    def get_admin(u=Depends(get_user)):
        if not u["is_admin"]:
            raise HTTPException(403, "Nur für Admin")
        return u

    def hinweis_ok(u=Depends(get_user)):
        if not u["notice_accepted_at"]:
            raise HTTPException(403, "Bitte zuerst den Hinweis bestätigen")
        return u

    def set_cookie(resp: Response, token: str):
        resp.set_cookie(COOKIE, token, httponly=True, samesite="strict", secure=config.COOKIE_SECURE,
                        max_age=config.SESSION_DAYS * 86400)

    def fehler(e: Exception, code: int = 400):
        raise HTTPException(code, str(e))

    # ----- Zugang -----

    @app.get("/api/status")
    def status(c=Depends(get_conn)):
        return {"setup_noetig": auth.user_count(c) == 0}

    @app.post("/api/setup")
    def setup(b: Login, resp: Response, c=Depends(get_conn)):
        if auth.user_count(c) > 0:
            raise HTTPException(403, "Setup bereits erledigt")
        try:
            auth.create_user(c, b.name, b.pw, is_admin=True)
        except ValueError as e:
            fehler(e)
        set_cookie(resp, auth.login(c, b.name, b.pw))
        return {"ok": True}

    @app.post("/api/register")
    def register(b: Register, resp: Response, c=Depends(get_conn)):
        try:
            auth.create_user(c, b.name, b.pw, invite=b.invite)
        except ValueError as e:
            fehler(e)
        set_cookie(resp, auth.login(c, b.name, b.pw))
        return {"ok": True}

    @app.post("/api/login")
    def login(b: Login, resp: Response, c=Depends(get_conn)):
        token = auth.login(c, b.name, b.pw)
        if not token:
            raise HTTPException(401, "Name oder Passwort falsch (nach 5 Fehlversuchen 10 Min. gesperrt)")
        set_cookie(resp, token)
        return {"ok": True}

    @app.post("/api/logout")
    def logout(request: Request, resp: Response, c=Depends(get_conn)):
        auth.logout(c, request.cookies.get(COOKIE, ""))
        resp.delete_cookie(COOKIE)
        return {"ok": True}

    @app.get("/api/me")
    def me(u=Depends(get_user)):
        return {"name": u["name"], "is_admin": bool(u["is_admin"]), "hinweis_bestaetigt": bool(u["notice_accepted_at"])}

    @app.post("/api/hinweis")
    def hinweis(u=Depends(get_user), c=Depends(get_conn)):
        auth.accept_notice(c, u["id"])
        return {"ok": True}

    @app.post("/api/passwort")
    def passwort(b: Passwort, u=Depends(get_user), c=Depends(get_conn)):
        try:
            auth.change_password(c, u["id"], b.alt, b.neu)
        except ValueError as e:
            fehler(e)
        return {"ok": True}

    # ----- Admin -----

    @app.post("/api/admin/einladung")
    def einladung(u=Depends(get_admin), c=Depends(get_conn)):
        return {"code": auth.create_invite(c, u["id"])}

    @app.get("/api/admin/modelle")
    def modelle(u=Depends(get_admin), c=Depends(get_conn)):
        return {
            "zuordnung": llm.zuordnung(c),
            "verfuegbar": llm.verfuegbare_anbieter(c),
            "verbrauch_heute": llm.verbrauch_heute(c),
            "nutzer": db.rows(c, "SELECT name, is_admin, created_at FROM users ORDER BY id"),
        }

    @app.put("/api/admin/modelle")
    def modelle_setzen(b: Modelle, u=Depends(get_admin), c=Depends(get_conn)):
        for rolle, kette in b.rollen.items():
            if any(len(e) != 3 for e in kette):
                raise HTTPException(400, f"Rolle {rolle}: jeder Eintrag braucht [anbieter, modell, familie]")
        db.set_setting(c, "modelle", {"rollen": b.rollen})
        return {"ok": True}

    @app.post("/api/admin/produkt/{isin}/fakt")
    def produkt_fakt(isin: str, b: ProduktFakt, u=Depends(get_admin), c=Depends(get_conn)):
        try:
            value = json.loads(b.value)
        except json.JSONDecodeError:
            value = b.value
        try:
            products.setze_fakt(c, isin, b.key, value, b.quelle)
        except ValueError as e:
            fehler(e)
        return {"ok": True}

    @app.post("/api/admin/produkt/{isin}/yahoo")
    def produkt_yahoo(isin: str, u=Depends(get_admin), c=Depends(get_conn)):
        p = products.finde(isin)
        if not p:
            raise HTTPException(404, "Produkt nicht im Katalog")
        return {"geladen": products.lade_yahoo_fakten(c, p)}

    # ----- Profil -----

    @app.get("/api/profil")
    def profil(u=Depends(get_user), c=Depends(get_conn)):
        return {"aktuell": profile.current(c, u["id"]), "offen": profile.pending(c, u["id"]), "labels": profile.LABELS}

    @app.post("/api/profil")
    def profil_setzen(b: Fakt, u=Depends(get_user), c=Depends(get_conn)):
        return {"id": profile.set_value(c, u["id"], b.key, b.value, b.status)}

    @app.post("/api/profil/{fid}/bestaetigen")
    def profil_ok(fid: int, b: Bestaetigen, u=Depends(get_user), c=Depends(get_conn)):
        if not profile.confirm(c, u["id"], fid, b.value):
            raise HTTPException(404, "Nicht gefunden")
        return {"ok": True}

    @app.post("/api/profil/{fid}/ablehnen")
    def profil_nein(fid: int, u=Depends(get_user), c=Depends(get_conn)):
        if not profile.reject(c, u["id"], fid):
            raise HTTPException(404, "Nicht gefunden")
        return {"ok": True}

    # ----- Council -----

    def _klaeren_bg(c, sid, text):
        c.execute("UPDATE council_sessions SET progress = 'Moderator denkt nach' WHERE id = ?", (sid,))
        c.commit()
        try:
            d = council.klaeren(c, sid, text)
            if (d.get("recherche") or "").strip():
                c.execute("UPDATE council_sessions SET progress = 'Suche aktuelle Quellen' WHERE id = ?", (sid,))
                c.commit()
                council.recherche_anhaengen(c, sid, d["recherche"].strip())
                c.execute("UPDATE council_sessions SET progress = 'Moderator wertet die Quellen aus' WHERE id = ?", (sid,))
                c.commit()
                council.klaeren(c, sid, None)
            c.execute("UPDATE council_sessions SET progress = NULL, error = NULL WHERE id = ?", (sid,))
        except Exception as e:
            c.execute("UPDATE council_sessions SET progress = NULL, error = ? WHERE id = ?", (str(e), sid))
        c.commit()

    @app.get("/api/council")
    def council_liste(u=Depends(get_user), c=Depends(get_conn)):
        return db.rows(c, "SELECT id, idea, status, created_at FROM council_sessions WHERE user_id = ? ORDER BY id DESC",
                       (u["id"],))

    @app.post("/api/council")
    def council_neu(b: NeueSitzung, u=Depends(hinweis_ok), c=Depends(get_conn)):
        eigene = [r for r in b.research_ids if research.get(c, u["id"], r)]
        try:
            sid = council.create(c, u["id"], b.idea, eigene)
        except ValueError as e:
            fehler(e)
        run_bg(_klaeren_bg, sid, None)
        return {"id": sid}

    def _session_or_404(c, u, sid):
        s = council.session_for(c, u["id"], sid)
        if not s:
            raise HTTPException(404, "Sitzung nicht gefunden")
        return s

    @app.get("/api/council/{sid}")
    def council_get(sid: int, u=Depends(get_user), c=Depends(get_conn)):
        s = _session_or_404(c, u, sid)
        s["result"] = json.loads(s.pop("result_json")) if s["result_json"] else None
        s["research_ids"] = json.loads(s["research_ids"])
        return {
            "session": s,
            "messages": council.messages_for(c, sid),
            "profil_offen": [f for f in profile.pending(c, u["id"]) if f["session_id"] == sid],
            "warnung": llm.familien_warnung(c, council.FACH),
        }

    @app.post("/api/council/{sid}/antwort")
    def council_antwort(sid: int, b: Antwort, u=Depends(hinweis_ok), c=Depends(get_conn)):
        s = _session_or_404(c, u, sid)
        if s["status"] != "klaeren" or s["progress"]:
            raise HTTPException(409, "Gerade nicht möglich")
        run_bg(_klaeren_bg, sid, b.text)
        return {"ok": True}

    @app.post("/api/council/{sid}/start")
    def council_start(sid: int, u=Depends(hinweis_ok), c=Depends(get_conn)):
        s = _session_or_404(c, u, sid)
        if s["status"] not in ("klaeren", "fehler") or (s["status"] == "klaeren" and s["progress"]):
            raise HTTPException(409, "Diskussion läuft bereits oder ist beendet")
        c.execute("UPDATE council_sessions SET status = 'laeuft', progress = 'Startet', error = NULL WHERE id = ?", (sid,))
        c.commit()
        run_bg(council.run, sid)
        return {"ok": True}

    # ----- Pläne -----

    @app.get("/api/plaene")
    def plaene(u=Depends(get_user), c=Depends(get_conn)):
        return {"plaene": plans.liste(c, u["id"]), "trefferquote": plans.trefferquote(c, u["id"])}

    @app.post("/api/plaene")
    def plan_neu(b: NeuerPlan, u=Depends(get_user), c=Depends(get_conn)):
        eingabe = b.model_dump()
        eingabe["produkte"] = [p for p in eingabe["produkte"]]
        try:
            return {"id": plans.freeze(c, u["id"], eingabe, b.session_id)}
        except LookupError as e:
            fehler(e, 404)
        except ValueError as e:
            fehler(e)

    @app.get("/api/plaene/{pid}")
    def plan_get(pid: int, u=Depends(get_user), c=Depends(get_conn)):
        p = plans.get(c, u["id"], pid)
        if not p:
            raise HTTPException(404, "Plan nicht gefunden")
        return p

    @app.post("/api/plaene/{pid}/auswerten")
    def plan_auswerten(pid: int, u=Depends(get_user), c=Depends(get_conn)):
        try:
            return plans.auswerten(c, u["id"], pid)
        except LookupError as e:
            fehler(e, 404)

    def _nachbesprechung_bg(c, uid, pid):
        p = plans.get(c, uid, pid)
        letzte = [a for a in p["nachtraege"] if a["kind"] == "auswertung"]
        auswertung = letzte[-1]["content"] if letzte else plans.auswerten(c, uid, pid)
        try:
            d, anbieter, modell = council.nachbesprechung(c, p, auswertung)
            d["modell"] = f"{anbieter}/{modell}"
        except Exception as e:
            d = {"fehler": str(e)}
        plans.nachtrag(c, uid, pid, "nachbesprechung", d)

    @app.post("/api/plaene/{pid}/nachbesprechung")
    def plan_nachbesprechung(pid: int, u=Depends(hinweis_ok), c=Depends(get_conn)):
        if not plans.get(c, u["id"], pid):
            raise HTTPException(404, "Plan nicht gefunden")
        run_bg(_nachbesprechung_bg, u["id"], pid)
        return {"ok": True}

    @app.post("/api/plaene/{pid}/notiz")
    def plan_notiz(pid: int, b: Notiz, u=Depends(get_user), c=Depends(get_conn)):
        try:
            return {"id": plans.nachtrag(c, u["id"], pid, "notiz", {"text": b.text})}
        except LookupError as e:
            fehler(e, 404)

    # ----- Recherche -----

    @app.get("/api/recherche")
    def recherche_liste(u=Depends(get_user), c=Depends(get_conn)):
        return {"liste": research.liste(c, u["id"]), "bereiche": research.BEREICHE,
                "quellen": research.quellen()}

    @app.post("/api/recherche")
    def recherche_neu(b: Recherche, u=Depends(hinweis_ok), c=Depends(get_conn)):
        if b.bereich not in research.BEREICHE:
            raise HTTPException(400, "Unbekannter Bereich")
        try:
            rid = research.start(c, u["id"], b.kind, b.query)
        except ValueError as e:
            fehler(e)
        run_bg(research.run, rid, b.bereich)
        return {"id": rid}

    @app.get("/api/recherche/{rid}")
    def recherche_get(rid: int, u=Depends(get_user), c=Depends(get_conn)):
        r = research.get(c, u["id"], rid)
        if not r:
            raise HTTPException(404, "Nicht gefunden")
        return r

    # ----- Produkte -----

    @app.get("/api/produkte")
    def produkte(u=Depends(get_user), c=Depends(get_conn)):
        return {
            "kategorien": products.kategorien(),
            "produkte": [{**p, "fakten": products.fakten(c, p["isin"]) if p["isin"] else {}} for p in products.katalog()],
            "regeln": [{"kpi": r[0], "name": r[1], "einheit": r[2], "gut": r[3], "mittel": r[4], "hoeher_besser": r[5]}
                       for r in products.REGELN],
            "benchmark": config.BENCHMARK,
        }

    @app.get("/api/produkte/{kennung}")
    def produkt(kennung: str, u=Depends(get_user), c=Depends(get_conn)):
        p = products.finde(kennung)
        if not p:
            raise HTTPException(404, "Nicht im Katalog")
        return products.detail(c, p)

    # ----- Rechner -----

    @app.get("/api/rechner/info")
    def rechner_info(u=Depends(get_user)):
        bz, jahr, geschaetzt = taxes.basiszins()
        return {"steuerklassen": taxes.KLASSEN, "basiszins": {"wert": bz, "jahr": jahr, "geschaetzt": geschaetzt},
                "klassen": {"aktien": "Aktien (Welt, hist. USA)", "anleihen": "Anleihen", "gold": "Gold",
                            "eigene": "Eigene Annahme (Tagesgeld, Krypto, Immobilien …)"}}

    @app.post("/api/steuern/mix")
    def steuern_mix(b: SteuernMix, u=Depends(get_user)):
        anteile = {k: v for k, v in b.anteile.items() if k in taxes.KLASSEN and v > 0}
        if not anteile:
            raise HTTPException(400, "Keine gültigen Steuerklassen")
        return [taxes.nach_steuern_mix(f.end_nominal, f.eingezahlt, b.jahre, f.verlauf, anteile, b.verheiratet, b.kirchensteuer)
                for f in b.faelle]

    @app.post("/api/rechner")
    def rechner(b: Rechner, u=Depends(get_user)):
        try:
            r = calculator.simulate(
                b.start, b.monthly, b.years, b.mix, ter=b.ter / 100, increase=b.increase / 100,
                custom_rate=b.custom_rate / 100 if b.custom_rate is not None else None,
            )
        except calculator.ZuWenigDaten as e:
            raise HTTPException(422, str(e))
        except ValueError as e:
            fehler(e)
        klasse = b.steuern.klasse or taxes.klasse_fuer_mix(r["mix"])
        steuerfrei = r["mix"].get("gold", 0) if klasse not in ("gold_physisch",) else 0
        mix_st = {k: v for k, v in (b.steuer_anteile or {}).items() if k in taxes.KLASSEN and v > 0}
        for s in r["szenarien"].values():
            if b.steuern.aktiv:
                if mix_st:
                    st = taxes.nach_steuern_mix(s["end_nominal"], s["eingezahlt"], b.years, s["verlauf"], mix_st,
                                                b.steuern.verheiratet, b.steuern.kirchensteuer)
                else:
                    st = taxes.nach_steuern(s["end_nominal"], s["eingezahlt"], b.years, klasse, s["verlauf"],
                                            b.steuern.verheiratet, b.steuern.kirchensteuer, steuerfreier_anteil=steuerfrei)
                s["steuer"] = st
                # Realwert nach Steuern: gleiche Kaufkraft-Umrechnung wie vor Steuern
                s["end_real_netto"] = s["end_real"] * st["netto"] / s["end_nominal"] if s["end_nominal"] else 0
            del s["verlauf"]
        r["steuerklasse"] = klasse
        r["steuerklasse_name"] = taxes.KLASSEN[klasse]
        return r


    # ----- Portfolios -----

    @app.get("/api/portfolios")
    def portfolios_liste(u=Depends(get_user), c=Depends(get_conn)):
        return {"portfolios": portfolios.liste(c, u["id"]), "benchmark": config.BENCHMARK,
                "klassen": scenarios.klassen()}

    @app.post("/api/portfolios")
    def portfolio_neu(b: PortfolioEingabe, u=Depends(get_user), c=Depends(get_conn)):
        try:
            return {"id": portfolios.anlegen(c, u["id"], b.model_dump())}
        except ValueError as e:
            fehler(e)

    @app.get("/api/portfolios/{pid}")
    def portfolio_get(pid: int, u=Depends(get_user), c=Depends(get_conn)):
        p = portfolios.get(c, u["id"], pid)
        if not p:
            raise HTTPException(404, "Portfolio nicht gefunden")
        return p

    @app.put("/api/portfolios/{pid}")
    def portfolio_aendern(pid: int, b: PortfolioEingabe, u=Depends(get_user), c=Depends(get_conn)):
        try:
            ok = portfolios.aendern(c, u["id"], pid, b.model_dump())
        except ValueError as e:
            fehler(e)
        if not ok:
            raise HTTPException(404, "Portfolio nicht gefunden")
        return {"ok": True}

    @app.delete("/api/portfolios/{pid}")
    def portfolio_loeschen(pid: int, u=Depends(get_user), c=Depends(get_conn)):
        if not portfolios.loeschen(c, u["id"], pid):
            raise HTTPException(404, "Portfolio nicht gefunden")
        return {"ok": True}

    @app.get("/api/kurse")
    def kurse(tickers: str, start: str, u=Depends(get_user), c=Depends(get_conn)):
        from datetime import date as _date
        liste = [t.strip() for t in tickers.split(",") if t.strip()][:25]
        try:
            s = _date.fromisoformat(start)
        except ValueError:
            raise HTTPException(400, "Startdatum ungültig")
        return {"kurse": portfolios.kurse(c, liste, s), "quelle": "Yahoo Finance (yfinance), Wochenschlusskurse"}

    # ----- Szenarien -----

    @app.get("/api/szenarien")
    def szenarien(u=Depends(get_user)):
        return scenarios.daten()

    @app.post("/api/szenario/ki")
    def szenario_ki(b: SzenarioKI, u=Depends(hinweis_ok), c=Depends(get_conn)):
        try:
            kid = scenarios.start(c, u["id"], b.model_dump())
        except ValueError as e:
            fehler(e)
        run_bg(scenarios.run, kid)
        return {"id": kid}

    @app.get("/api/szenario/ki/{kid}")
    def szenario_ki_get(kid: int, u=Depends(get_user), c=Depends(get_conn)):
        r = scenarios.get(c, u["id"], kid)
        if not r:
            raise HTTPException(404, "Nicht gefunden")
        return r

    @app.post("/api/plaene/{pid}/szenario")
    def plan_szenario(pid: int, b: SzenarioNotiz, u=Depends(get_user), c=Depends(get_conn)):
        try:
            return {"id": plans.nachtrag(c, u["id"], pid, "szenario", b.inhalt)}
        except LookupError as e:
            fehler(e, 404)


    def _recherche_council_bg(c, sid, query):
        try:
            council.recherche_anhaengen(c, sid, query)
            c.execute("UPDATE council_sessions SET progress = NULL WHERE id = ?", (sid,))
        except Exception as e:
            c.execute("UPDATE council_sessions SET progress = NULL, error = ? WHERE id = ?", (str(e), sid))
        c.commit()

    @app.post("/api/council/{sid}/recherche")
    def council_recherche(sid: int, b: Suche, u=Depends(hinweis_ok), c=Depends(get_conn)):
        s = _session_or_404(c, u, sid)
        if s["progress"] and s["status"] in ("klaeren", "laeuft"):
            raise HTTPException(409, "Gerade beschäftigt – gleich nochmal versuchen")
        if not b.query.strip():
            raise HTTPException(400, "Suchbegriff fehlt")
        c.execute("UPDATE council_sessions SET progress = 'Suche aktuelle Quellen' WHERE id = ?", (sid,))
        c.commit()
        run_bg(_recherche_council_bg, sid, b.query.strip()[:200])
        return {"ok": True}

    # ----- Glossar, Medien -----

    @app.get("/api/glossar")
    def glossar_alle(u=Depends(get_user)):
        return glossar.daten()

    @app.get("/api/medien")
    def medien(u=Depends(get_user)):
        return glossar.medien()

    # ----- Entwurf (Warenkorb) -----

    @app.get("/api/entwurf")
    def entwurf_get(u=Depends(get_user), c=Depends(get_conn)):
        return entwurf.get(c, u["id"])

    @app.put("/api/entwurf")
    def entwurf_put(b: dict, u=Depends(get_user), c=Depends(get_conn)):
        try:
            return entwurf.speichern(c, u["id"], b)
        except ValueError as e:
            fehler(e)

    @app.post("/api/entwurf/position")
    def entwurf_position(b: EntwurfPosition, u=Depends(get_user), c=Depends(get_conn)):
        try:
            return entwurf.hinzufuegen(c, u["id"], b.model_dump())
        except ValueError as e:
            fehler(e)

    @app.delete("/api/entwurf")
    def entwurf_leeren(u=Depends(get_user), c=Depends(get_conn)):
        entwurf.leeren(c, u["id"])
        return {"ok": True}

    @app.post("/api/entwurf/speichern")
    def entwurf_als_portfolio(u=Depends(get_user), c=Depends(get_conn)):
        e = entwurf.get(c, u["id"])
        try:
            pid = portfolios.anlegen(c, u["id"], entwurf.als_portfolio(e))
        except ValueError as ex:
            fehler(ex)
        entwurf.leeren(c, u["id"])
        return {"id": pid}

    # ----- Portfolio-Council -----

    @app.get("/api/berater")
    def berater_liste(u=Depends(get_user), c=Depends(get_conn)):
        return berater.liste(c, u["id"])

    @app.post("/api/berater")
    def berater_neu(b: BeraterStart, u=Depends(hinweis_ok), c=Depends(get_conn)):
        if not b.text.strip():
            raise HTTPException(400, "Schreib, was für ein Portfolio du bauen möchtest.")
        cid = berater.anlegen(c, u["id"], b.text.strip()[:120])
        c.execute("UPDATE berater_chats SET status = 'denkt' WHERE id = ?", (cid,))
        c.commit()
        run_bg(berater.antworten, cid, b.text)
        return {"id": cid}

    @app.get("/api/berater/{cid}")
    def berater_get(cid: int, u=Depends(get_user), c=Depends(get_conn)):
        ch = berater.chat_for(c, u["id"], cid)
        if not ch:
            raise HTTPException(404, "Gespräch nicht gefunden")
        return {"chat": ch, "nachrichten": berater.nachrichten(c, cid), "entwurf": entwurf.get(c, u["id"]),
                "profil_offen": profile.pending(c, u["id"])}

    @app.post("/api/berater/{cid}")
    def berater_nachricht(cid: int, b: BeraterStart, u=Depends(hinweis_ok), c=Depends(get_conn)):
        ch = berater.chat_for(c, u["id"], cid)
        if not ch:
            raise HTTPException(404, "Gespräch nicht gefunden")
        if ch["status"] == "denkt":
            raise HTTPException(409, "Der Council antwortet noch")
        if not b.text.strip():
            raise HTTPException(400, "Nachricht fehlt")
        c.execute("UPDATE berater_chats SET status = 'denkt', error = NULL WHERE id = ?", (cid,))
        c.commit()
        run_bg(berater.antworten, cid, b.text)
        return {"ok": True}

    @app.post("/api/berater/{cid}/uebernehmen/{mid}")
    def berater_uebernehmen(cid: int, mid: int, u=Depends(get_user), c=Depends(get_conn)):
        if not berater.chat_for(c, u["id"], cid):
            raise HTTPException(404, "Gespräch nicht gefunden")
        m = next((x for x in berater.nachrichten(c, cid) if x["id"] == mid and x["rolle"] == "berater"), None)
        if not m or not (m["data"] or {}).get("vorschlag"):
            raise HTTPException(404, "Kein Vorschlag")
        v = m["data"]["vorschlag"]
        e = entwurf.get(c, u["id"])
        e["positionen"] = v.get("aufgeloest") or []
        if v.get("name") and not e["name"]:
            e["name"] = v["name"]
        return entwurf.speichern(c, u["id"], e)

    # ----- Web-App -----

    app.mount("/static", StaticFiles(directory=STATIC), name="static")

    @app.get("/")
    def index():
        return FileResponse(STATIC / "index.html")

    @app.get("/sw.js")
    def sw():
        return FileResponse(STATIC / "sw.js", media_type="application/javascript")

    return app


app = create_app()
