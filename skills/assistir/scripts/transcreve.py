"""Transcreve um WAV mono 16 kHz em português com faster-whisper (sem depender do PyAV)."""
import os

os.environ["HF_HUB_DISABLE_XET"] = "1"
import sys
import wave

import numpy as np
from faster_whisper import WhisperModel

w = wave.open(sys.argv[1])
audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
model = WhisperModel(os.environ.get("ASSISTIR_MODELO", "small"), device="cpu", compute_type="int8")
segs, _ = model.transcribe(audio, language="pt")
for s in segs:
    print(f"[{s.start:5.1f}s] {s.text.strip()}")
