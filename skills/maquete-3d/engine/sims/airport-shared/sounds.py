"""Small procedural sounds the simulator scores share: motor whines, hiss, thumps, hums, rattles, a spot weld."""

import math

from sfx.score_kit import env_fade
from sfx.synth import SR, bandnoise


def servo(dur, f0=420.0, f1=760.0):
    n = int(dur * SR)
    out = [0.0] * n
    ph = 0.0
    for k in range(n):
        u = k / n
        ph += 2 * math.pi * (f0 + (f1 - f0) * math.sin(math.pi * u)) / SR
        out[k] = math.sin(math.pi * u) ** 0.8 * (0.6 * math.sin(ph) + 0.25 * math.sin(2 * ph))
    return env_fade(out, 0.05, 0.1)


def hiss(dur, fc=5200):
    n = int(dur * SR)
    return env_fade(bandnoise(n, lambda k: fc, q=0.6), 0.15, 0.3)


def thump():
    n = int(0.5 * SR)
    out = [0.0] * n
    ph = 0.0
    for k in range(n):
        u = k / SR
        ph += 2 * math.pi * (70 - 30 * u) / SR
        out[k] = math.sin(ph) * math.exp(-u / 0.12)
    return out


def hum(dur, f=110.0, level=1.0):
    n = int(dur * SR)
    out = [0.0] * n
    ph = 0.0
    for k in range(n):
        u = k / n
        ph += 2 * math.pi * (f + 60 * math.sin(math.pi * u)) / SR
        out[k] = level * math.sin(math.pi * u) ** 0.5 * (0.5 * math.sin(ph) + 0.3 * math.sin(3 * ph))
    return env_fade(out, 0.3, 0.5)


def rattle(dur, rate=28.0):
    n = int(dur * SR)
    no = bandnoise(n, lambda k: 2600, q=1.2)
    return [no[k] * (0.5 + 0.5 * math.sin(2 * math.pi * rate * k / SR)) for k in range(n)]


def weld(dur=0.6):
    """A spot weld: a sharp crack, then a crackling sizzle."""
    n = int(dur * SR)
    no = bandnoise(n, lambda k: 4200, q=0.7)
    out = [0.0] * n
    for k in range(n):
        u = k / SR
        crack = math.exp(-u / 0.012)
        fizz = 0.5 * (1 if (k * 7919) % 97 < 30 else 0.35)
        out[k] = no[k] * (crack * 2.0 + fizz * math.exp(-u / 0.35))
    return out
