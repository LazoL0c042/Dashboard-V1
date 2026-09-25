"""Lokale Spracherkennung mit Whisper (faster-whisper).

Das Audio verlässt nie den Server und wird nicht gespeichert: Es liegt nur
für die Dauer der Transkription in einer temporären Datei. Das Modell wird
beim ersten Aufruf geladen (einmaliger Download, danach offline).
"""
import os
import tempfile
import threading

from . import config

SUFFIX = {
    "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/x-m4a": ".m4a",
    "audio/aac": ".aac", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav",
}

_model = None
_load_lock = threading.Lock()
_run_lock = threading.Lock()  # eine Transkription gleichzeitig, sonst wird der Laptop zäh


class TranscriberUnavailable(RuntimeError):
    """Whisper ist nicht installiert oder das Modell lässt sich nicht laden."""


def _load():
    global _model
    with _load_lock:
        if _model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as exc:
                raise TranscriberUnavailable(
                    "faster-whisper ist nicht installiert (pip install -r requirements.txt)") from exc
            try:
                _model = WhisperModel(config.WHISPER_MODEL, device=config.WHISPER_DEVICE,
                                      compute_type=config.WHISPER_COMPUTE_TYPE)
            except Exception as exc:
                raise TranscriberUnavailable(
                    f"Whisper-Modell '{config.WHISPER_MODEL}' nicht ladbar: {exc}") from exc
    return _model


def transcribe(audio: bytes, content_type: str = "", hint: str = "") -> str:
    """Audio (webm, mp4/m4a, ogg, wav …) → Text. hint = Fachbegriffe, die Whisper kennen soll."""
    model = _load()
    suffix = SUFFIX.get(content_type.split(";")[0].strip().lower(), ".bin")
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio)
        with _run_lock:
            segments, _ = model.transcribe(path, language=config.WHISPER_LANGUAGE,
                                           vad_filter=True, initial_prompt=hint or None)
            return " ".join(s.text.strip() for s in segments).strip()
    finally:
        os.unlink(path)


if __name__ == "__main__":
    # Modell vorab laden, damit die erste Eingabe nicht auf den Download wartet:
    #   python -m app.transcriber
    _load()
    print(f"Whisper-Modell '{config.WHISPER_MODEL}' ist bereit.")
