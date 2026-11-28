"""Spracheingabe als Rückfallebene: Audio wird auf dem eigenen Server mit Whisper transkribiert.

Bevorzugt nutzt die App die Spracherkennung des Browsers (Safari/Chrome). Nur wenn die fehlt, schickt
sie eine Aufnahme hierher. Das Audio wird nicht gespeichert. faster-whisper ist optional
(pip install faster-whisper); ohne Installation meldet die Funktion das klar.
"""
import os
import tempfile
from functools import lru_cache


class NichtVerfuegbar(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _modell():
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise NichtVerfuegbar("Spracherkennung auf dem Server ist nicht installiert (faster-whisper).") from e
    return WhisperModel(os.getenv("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")


def transkribieren(audio: bytes, endung: str = ".webm") -> str:
    if len(audio) > 15_000_000:
        raise ValueError("Aufnahme zu lang.")
    modell = _modell()
    with tempfile.NamedTemporaryFile(suffix=endung) as f:
        f.write(audio)
        f.flush()
        segmente, _ = modell.transcribe(f.name, language="de", vad_filter=True)
        return " ".join(s.text.strip() for s in segmente).strip()
