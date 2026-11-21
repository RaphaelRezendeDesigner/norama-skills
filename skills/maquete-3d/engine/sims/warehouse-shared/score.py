"""Action sounds for the toy logistics network film (warehouse-film; times from warehouse-shared/world.js T and
the clicks in film.js): forklift hums, lifts and reverse beeps, the trucks' diesel and reversing beepers, shutters.

The operator's clicks and the site dropdown; at B12 HL-03's hydraulics and the ULD rolling over the deck rollers onto
the dolly; BT-14's electric hum on the run to Cargo C; FL-02's lift and its reverse beeps; TRK-2205's diesel along the
apron road and its reverse beeper into D6, D6's shutter rattling up; at B11 the bridge's drive, PB-07's hum on the push
and AU 207's engines spooling up and carrying through the taxi; at B10 CT-02's scissor lift. A soft air sweep on every
camera glide between sites. Real airport ambience goes under it at the mix.
"""

import importlib.util
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "airport-shared"))

from sfx.score_kit import airy, env_fade, hz  # noqa: E402
from sfx.synth import SR, bandnoise, blip, chime, click  # noqa: E402

from sounds import servo,hiss,thump,hum,rattle  # noqa: E402

TIMELINE = "../warehouse-film/timeline.json"
TARGET_LUFS = -14.0
SEED = 2051

def beeps(dur, every=0.6, f=1150.0):
    """a reversing beeper"""
    n = int(dur * SR)
    out = [0.0] * n
    for k in range(n):
        u = k / SR
        on = (u % every) < 0.3
        out[k] = (0.6 * math.sin(2 * math.pi * f * u)) if on else 0.0
    return env_fade(out, 0.01, 0.05)


PER = 4.6
LOAD0, LOAD1 = -4.6, 7.4
LEAVE, REVERSE = (7.6, 15.2), (15.4, 18.6)
UNLOAD = (19.0, 25.4)
COLD, COLD_REV = (23.0, 27.4), (27.6, 31.2)
GLIDES = [(18.8, 21.6), (25.7, 27.4), (32.8, 35.4)]
DROPDOWN = (24.6, 25.7)


def forklift_cycle(mix, t0, n, pan):
    for k in range(n):
        c0 = t0 + k * PER
        if c0 + PER < 0:
            continue
        for u0, u1 in ((0.0, 0.12), (0.42, 0.6), (0.9, 1.0)):
            a = c0 + u0 * PER
            if a >= 0:
                mix.put(a, hum((u1 - u0) * PER, 190, 0.8), 0.009, pan=pan)
        a = c0 + 0.12 * PER
        if a >= 0:
            mix.put(a, servo(0.08 * PER, 300, 540), 0.01, pan=pan)
        a = c0 + 0.2 * PER
        if a >= 0:
            mix.put(a, beeps(0.1 * PER, 0.45, 1400), 0.006, pan=pan)
        a = c0 + 0.6 * PER
        if a >= 0:
            mix.put(a, servo(0.08 * PER, 540, 300), 0.01, pan=pan)
            mix.put(a + 0.08 * PER, click(800, 0.05), 0.03, pan=pan)


def score(mix, tl):
    for t in tl["clicks"]:
        mix.put(t - 0.02, click(2600, 0.02), 0.05, pan=0.3)
        mix.put(t + 0.06, blip(hz("E6"), 0.08, 0.04), 0.012, pan=0.3)
        mix.put(t + 0.05, airy(0.35, 1400, 2600, 0.6), 0.006, pan=0.4)
    mix.put(DROPDOWN[0] + 0.05, blip(hz("B5"), 0.12, 0.05), 0.012, pan=0.5)
    mix.put(DROPDOWN[1] + 0.05, blip(hz("E6"), 0.12, 0.05), 0.012, pan=0.2)
    for a, b in GLIDES:
        mix.put(a, airy(b - a, 500, 1800, 0.6), 0.012)
    forklift_cycle(mix, LOAD0, 3, -0.3)
    forklift_cycle(mix, UNLOAD[0], 2, 0.2)
    # TRK-2051: the hub door, the drive, the reverse, the cross-dock shutter
    mix.put(LEAVE[0] + 1.0, rattle(1.0, 34), 0.016, pan=-0.2)
    mix.put(LEAVE[0], hum(LEAVE[1] - LEAVE[0], 58, 1.0), 0.022)
    mix.put(REVERSE[0], beeps(REVERSE[1] - REVERSE[0], 0.6, 1150), 0.009, pan=0.2)
    mix.put(REVERSE[0], hum(REVERSE[1] - REVERSE[0], 55, 0.8), 0.016, pan=0.2)
    mix.put(REVERSE[1] - 0.25, hiss(0.5, 2400), 0.026, pan=0.2)
    mix.put(REVERSE[1] - 1.2, rattle(1.2, 34), 0.016, pan=0.2)
    # TRK-2148 at the cold store
    mix.put(COLD[0], hum(COLD[1] - COLD[0], 60, 0.9), 0.016, pan=-0.3)
    mix.put(COLD_REV[0], beeps(COLD_REV[1] - COLD_REV[0], 0.6, 1100), 0.008, pan=-0.2)
    mix.put(COLD_REV[1] - 0.25, hiss(0.5, 2400), 0.024, pan=-0.2)
    mix.put(COLD_REV[1] - 1.2, rattle(1.2, 34), 0.014, pan=-0.2)
    mix.put(33.2, chime([hz("E5"), hz("B5"), hz("E6")], 1.6, 0.5), 0.008)
