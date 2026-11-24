import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(not shutil.which("node"), reason="Node.js nicht installiert")
def test_rechnen_js():
    base = Path(__file__).resolve().parent.parent
    r = subprocess.run(["node", "tests/js/test_rechnen.js"], cwd=base, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr + r.stdout
