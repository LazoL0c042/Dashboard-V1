import pytest

from app import auth, profile


def test_login_richtig_und_falsch(conn, user):
    assert auth.login(conn, "peter", "falsch!!!") is None
    tok = auth.login(conn, "Peter", "geheim123")
    assert tok and auth.user_for_token(conn, tok)["id"] == user


def test_sperre_nach_fehlversuchen(conn, user):
    for _ in range(auth.MAX_FEHLVERSUCHE):
        auth.login(conn, "peter", "falsch!!!")
    assert auth.login(conn, "peter", "geheim123") is None


def test_einladung_nur_einmal(conn, user):
    code = auth.create_invite(conn, user)
    auth.create_user(conn, "anna", "geheim456", invite=code)
    with pytest.raises(ValueError, match="Einladungscode"):
        auth.create_user(conn, "bert", "geheim789", invite=code)


def test_logout(conn, user):
    tok = auth.login(conn, "peter", "geheim123")
    auth.logout(conn, tok)
    assert auth.user_for_token(conn, tok) is None


def test_profil_erst_nach_bestaetigung(conn, user):
    fid = profile.propose(conn, user, "alter", "34")
    assert profile.current(conn, user) == {}
    assert profile.confirm(conn, user, fid)
    assert profile.current(conn, user)["alter"]["value"] == "34"


def test_profil_neuer_wert_ersetzt_alten(conn, user):
    profile.set_value(conn, user, "sparrate", "500")
    profile.set_value(conn, user, "sparrate", "650")
    assert profile.current(conn, user)["sparrate"]["value"] == "650"


def test_fremder_nutzer_kann_nicht_bestaetigen(conn, user, user2):
    fid = profile.propose(conn, user, "alter", "34")
    assert not profile.confirm(conn, user2, fid)
    assert profile.current(conn, user2) == {}


def test_schaetzung_im_text_markiert(conn, user):
    profile.set_value(conn, user, "einkommen", "3000", status="geschaetzt")
    assert "(geschätzt)" in profile.as_text(conn, user)
