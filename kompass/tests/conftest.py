import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import db  # noqa: E402


@pytest.fixture
def conn():
    c = db.connect(":memory:")
    yield c
    c.close()


@pytest.fixture
def user(conn):
    from app import auth

    return auth.create_user(conn, "peter", "geheim123", is_admin=True)


@pytest.fixture
def user2(conn):
    from app import auth

    return auth.create_user(conn, "anna", "geheim456")
