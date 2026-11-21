"""Action sounds for the toy car plant film (plant-film; times from plant-shared/world.js T and the
clicks in film.js).

The operator's clicks and the site dropdown; cell C4's spot welds and servo whines; the press thumping on its 3 s
stroke; the conveyor's hum on every move; booth 2's doors and the paint bells' hiss; AGV-12's motor and its arrival
chime; a nutrunner rattle on each of the 4 wheels; the trim gripper; the lift's hydraulics; the car's electric hum,
the rolling road's rising whine; the carrier ramp folding up. A soft air sweep on every camera glide. Real factory
ambience goes under it at the mix.
"""

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "airport-shared"))

from sfx.score_kit import airy, hz  # noqa: E402
from sfx.synth import blip, chime, click  # noqa: E402

from sounds import servo,hiss,thump,hum,rattle,weld  # noqa: E402

TIMELINE = "../plant-film/timeline.json"
TARGET_LUFS = -14.0
SEED = 412

WELD = (0.4, 5.6)
MOVES = [(6.4, 12.6), (18.4, 23.0), (29.0, 30.6), (32.6, 34.8)]
BOOTH_DOORS = [(11.6, 12.4), (17.6, 18.2)]
SPRAY = (13.2, 17.2)
AGV = (23.4, 26.6)
FITS = [25.8, 26.4, 27.6, 28.2]
TRIM = (30.6, 32.6)
LIFT = (34.8, 35.6)
TO_DYNO = (35.6, 37.2)
TEST = (37.4, 41.0)
OUT = (41.2, 45.0)
RAMP_UP = (45.4, 46.8)
GLIDES = [(20.8, 23.2), (32.8, 35.4), (46.2, 48.8)]
DROPDOWN = (19.4, 20.8)


def score(mix, tl):
    for t in tl["clicks"]:
        mix.put(t - 0.02, click(2600, 0.02), 0.05, pan=0.3)
        mix.put(t + 0.06, blip(hz("E6"), 0.08, 0.04), 0.012, pan=0.3)
        mix.put(t + 0.05, airy(0.35, 1400, 2600, 0.6), 0.006, pan=0.4)
    mix.put(DROPDOWN[0] + 0.05, blip(hz("B5"), 0.12, 0.05), 0.012, pan=0.5)
    mix.put(DROPDOWN[1] + 0.05, blip(hz("E6"), 0.12, 0.05), 0.012, pan=0.2)
    for a, b in GLIDES:
        mix.put(a, airy(b - a, 500, 1800, 0.6), 0.012)
    # cell C4: 4 welders, a cycle of 1.5 s each, phase 0.37 s apart: move (servo), then the weld
    for i in range(4):
        pan = (-0.4, -0.15, 0.15, 0.4)[i]
        k = 0
        while True:
            c0 = k * 1.5 - i * 0.37
            k += 1
            if c0 < WELD[0] - 1.5:
                continue
            if c0 > WELD[1] - 0.6:
                break
            if c0 >= WELD[0] - 0.2:
                mix.put(c0, servo(0.45, 520, 820), 0.005, pan=pan)
                mix.put(c0 + 0.6, weld(0.7), 0.026, pan=pan)
    # the press, every 3 s at the bottom of its stroke
    t = 1.5
    while t < 50:
        mix.put(t, thump(), 0.03, pan=-0.5)
        t += 3.0
    # the conveyor on every move
    for a, b in MOVES:
        mix.put(a, hum(b - a, 120, 0.9), 0.014)
        mix.put(a, rattle(b - a, 18), 0.004)
    # booth 2
    for a, b in BOOTH_DOORS:
        mix.put(a, rattle(b - a, 30), 0.016, pan=-0.2)
    mix.put(SPRAY[0], hiss(SPRAY[1] - SPRAY[0], 3200), 0.03, pan=-0.1)
    mix.put(SPRAY[0], servo(SPRAY[1] - SPRAY[0], 380, 560), 0.005, pan=-0.1)
    # AGV-12 and its arrival
    mix.put(AGV[0], hum(AGV[1] - AGV[0], 200, 0.7), 0.01, pan=-0.3)
    mix.put(AGV[1], chime([hz("A5"), hz("E6")], 0.8, 0.3), 0.008, pan=-0.3)
    # the 4 wheels: robot move, nutrunner, click
    for i, t in enumerate(FITS):
        pan = -0.3 if i in (0, 2) else 0.3
        mix.put(t - 1.0, servo(0.9, 360, 620), 0.007, pan=pan)
        mix.put(t - 0.05, rattle(0.45), 0.03, pan=pan)
        mix.put(t + 0.4, click(900, 0.05), 0.04, pan=pan)
    mix.put(TRIM[0], servo(TRIM[1] - TRIM[0], 300, 520), 0.008, pan=-0.2)
    # the lift, the drive, the rolling road, out to the carrier
    mix.put(LIFT[0], hum(LIFT[1] - LIFT[0], 70, 1.0), 0.02)
    mix.put(TO_DYNO[0], hum(TO_DYNO[1] - TO_DYNO[0], 160, 0.8), 0.014)
    mix.put(TEST[0], hum(TEST[1] - TEST[0], 220, 1.0), 0.022)
    mix.put(TEST[0], hiss(TEST[1] - TEST[0], 900), 0.008)
    mix.put(OUT[0], hum(OUT[1] - OUT[0], 150, 0.9), 0.016, pan=0.3)
    mix.put(RAMP_UP[0], hum(RAMP_UP[1] - RAMP_UP[0], 75, 1.0), 0.02, pan=0.4)
    mix.put(RAMP_UP[1], click(500, 0.08), 0.04, pan=0.4)
    mix.put(46.6, chime([hz("E5"), hz("B5"), hz("E6")], 1.6, 0.5), 0.008)
