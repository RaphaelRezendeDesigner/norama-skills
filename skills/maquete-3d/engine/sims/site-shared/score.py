"""Action sounds for the toy construction site film (site-film; times from site-shared/world.js T
and the clicks in film.js), under the cobra rebuild's calm code bed (D minor, 96 bpm, e-piano, bass, soft drums, a
pad), rendered as one mix.

EX-07's hydraulics on every swing, soil thudding into TP-14's bed, TP-14's diesel out to the road, DZ-03's push and
track rattle, formwork knocks and rebar ticks, the plant's drum charging, M-21's diesel along the road and its
reversing beeper down the ramp, the chute swinging out, the pour, block knocks on plots 2-3, the operator's clicks,
the dropdowns, a soft air sweep on every camera glide.

    python tools/motion/run_sfx.py tools/motion/sims/site-shared/score.py --out <wav>
"""

import importlib.util
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "airport-shared"))

from sfx.score_kit import airy, bed, chords, env_fade, hz  # noqa: E402
from sfx.synth import SR, bandnoise, blip, chime, click, envelope, pad  # noqa: E402

from sounds import servo,hiss,thump,hum,rattle  # noqa: E402

TIMELINE = "../site-film/timeline.json"
TARGET_LUFS = -14.0
SEED = 437

CHORDS = chords("Dm9:D3 F3 A3 C4 E4/D2", "Bbmaj7:Bb2 D3 F3 A3/Bb1", "Gm9:G2 Bb2 D3 F3 A3/G1", "A7sus:A2 D3 E3 G3/A1")
MOTIF = [(0.5, hz("A5")), (1.5, hz("F5")), (2.5, hz("E5"))]

PER, PH, EX_END = 4.6, 1.35, 6.9
T_LEAVE, LEVEL = (7.2, 12.0), (8.0, 12.4)
DOZER_OUT, FORM, REBAR = (12.6, 15.2), (12.6, 14.2), (14.2, 17.6)
LOAD, DRIVE, REVERSE, CHUTE, POUR = (14.0, 17.4), (17.6, 22.2), (22.4, 26.0), (26.2, 27.2), (27.4, 33.6)
WALLS = (33.8, 40.0)
GLIDES = [(14.1, 15.8), (34.9, 36.6), (40.0, 42.4)]
DROPDOWNS = [(13.0, 14.1), (33.8, 34.9)]


def beeps(dur, every=0.6, f=1150.0):
    n = int(dur * SR)
    out = [0.0] * n
    for k in range(n):
        u = k / SR
        out[k] = (0.6 * math.sin(2 * math.pi * f * u)) if (u % every) < 0.3 else 0.0
    return env_fade(out, 0.01, 0.05)


def pour_noise(dur):
    n = int(dur * SR)
    no = bandnoise(n, lambda k: 420, q=0.5)
    return env_fade([no[k] * (0.7 + 0.3 * math.sin(2 * math.pi * 3.1 * k / SR)) for k in range(n)], 0.4, 0.6)


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 96, CHORDS, MOTIF, motif_voice="blip", kicks=(0, 2.5), snares=(1, 3), hats=8, swing=0.08, keys_vel=0.75, keys_lp=3800)
    mix.put_stereo(0, left, right, 0.13)
    mix.put(0, low, 0.13)
    mix.put(0, drums, 0.05)
    bar = 4 * 60 / 96
    changes = [(0.12 + b * bar, [f for f in CHORDS[b % len(CHORDS)][0][:4]]) for b in range(int(dur / bar) + 1)]
    pl, pr = pad(dur, changes, volume=envelope([(0, 0), (1.0, 1), (dur - 1.6, 1), (dur, 0)]), detune=0.8, tremolo=0.18, xfade=0.5)
    mix.put_stereo(0, pl, pr, 0.07)

    for t in tl["clicks"]:
        mix.put(t - 0.02, click(2600, 0.02), 0.05, pan=0.3)
        mix.put(t + 0.06, blip(hz("E6"), 0.08, 0.04), 0.012, pan=0.3)
        mix.put(t + 0.05, airy(0.35, 1400, 2600, 0.6), 0.006, pan=0.4)
    for a, b in DROPDOWNS:
        mix.put(a + 0.05, blip(hz("B5"), 0.12, 0.05), 0.012, pan=0.5)
        mix.put(b + 0.05, blip(hz("E6"), 0.12, 0.05), 0.012, pan=0.2)
    for a, b in GLIDES:
        mix.put(a, airy(b - a, 500, 1800, 0.6), 0.012)
    # EX-07: a hydraulic whine on every move, soil into the bed at each dump
    for c in range(-1, 3):
        c0 = c * PER - PH
        for u0, u1 in ((0.0, 0.13), (0.27, 0.56), (0.56, 0.7)):
            a, b = c0 + u0 * PER, c0 + u1 * PER
            if 0 <= a < EX_END:
                mix.put(a, servo(b - a, 260, 480), 0.009, pan=0.35)
        tt = c0 + 0.64 * PER
        if 0 <= tt <= EX_END:
            mix.put(tt, thump(), 0.04, pan=0.35)
            mix.put(tt, rattle(0.5, 34), 0.02, pan=0.35)
    mix.put(EX_END, servo(1.4, 480, 260), 0.008, pan=0.35)
    # TP-14 out to the road
    mix.put(T_LEAVE[0], hum(T_LEAVE[1] - T_LEAVE[0], 58, 1.0), 0.02, pan=0.4)
    # DZ-03: push and track rattle, then up the ramp
    mix.put(LEVEL[0], hum(LEVEL[1] - LEVEL[0], 70, 1.0), 0.018, pan=-0.1)
    mix.put(LEVEL[0], rattle(LEVEL[1] - LEVEL[0], 14), 0.008, pan=-0.1)
    mix.put(DOZER_OUT[0], hum(DOZER_OUT[1] - DOZER_OUT[0], 70, 0.9), 0.012, pan=-0.2)
    # formwork knocks, rebar ticks
    for i in range(8):
        mix.put(FORM[0] + 0.2 * i, click(700, 0.05), 0.02, pan=-0.3 + 0.08 * i)
    for i in range(12):
        mix.put(REBAR[0] + 0.28 * i, click(2900, 0.02), 0.012, pan=0.3 - 0.05 * i)
    # the plant charging M-21, its drive, its reverse, the chute, the pour
    mix.put(LOAD[0], hum(LOAD[1] - LOAD[0], 120, 1.0), 0.016, pan=-0.3)
    mix.put(LOAD[0], rattle(LOAD[1] - LOAD[0], 9), 0.01, pan=-0.3)
    mix.put(DRIVE[0], hum(DRIVE[1] - DRIVE[0], 60, 1.0), 0.022)
    mix.put(REVERSE[0], beeps(REVERSE[1] - REVERSE[0], 0.6, 1150), 0.009, pan=0.1)
    mix.put(REVERSE[0], hum(REVERSE[1] - REVERSE[0], 55, 0.8), 0.016, pan=0.1)
    mix.put(CHUTE[0], servo(CHUTE[1] - CHUTE[0], 300, 520), 0.012, pan=0.1)
    mix.put(CHUTE[1], click(600, 0.07), 0.04, pan=0.1)
    mix.put(POUR[0], pour_noise(POUR[1] - POUR[0]), 0.03, pan=0.0)
    # block knocks on plots 2-3
    k = 0
    while WALLS[0] + 0.45 * k < WALLS[1]:
        mix.put(WALLS[0] + 0.45 * k, click(900 + 120 * (k % 3), 0.04), 0.016, pan=0.3)
        k += 1
    mix.put(40.4, chime([hz("E5"), hz("B5"), hz("E6")], 1.6, 0.5), 0.008)
