"""Action sounds for the toy airport film (airport-film; times from airport-shared/world.js T and the
clicks in film.js).

The operator's clicks and the site dropdown; at B12 HL-03's hydraulics and the ULD rolling over the deck rollers onto
the dolly; BT-14's electric hum on the run to Cargo C; FL-02's lift and its reverse beeps; TRK-2205's diesel along the
apron road and its reverse beeper into D6, D6's shutter rattling up; at B11 the bridge's drive, PB-07's hum on the push
and AU 207's engines spooling up and carrying through the taxi; at B10 CT-02's scissor lift. A soft air sweep on every
camera glide between sites. Real airport ambience goes under it at the mix.
"""

import math

from sfx.score_kit import airy, env_fade, hz
from sfx.synth import SR, bandnoise, blip, chime, click


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


TIMELINE = "../airport-film/timeline.json"
TARGET_LUFS = -14.0
SEED = 207

LOWER, SLIDE, DROP = (1.4, 3.0), (3.2, 4.4), (4.4, 5.4)
GO = (6.0, 13.0)
FORK_OUT, FORK_LIFT, FORK_BACK = (14.2, 15.8), (15.9, 16.7), (16.8, 18.6)
TRUCK_IN, TRUCK_BACK, D6 = (11.5, 18.0), (18.2, 21.0), (19.4, 20.6)
UNDOCK, PUSH, SPOOL = (26.0, 27.4), (27.6, 34.4), (31.0, 34.4)
CATER_IN, CATER_LIFT = (35.4, 37.8), (38.4, 41.8)
TAXI = (43.2, 50.0)
GLIDES = [(24.0, 26.6), (35.2, 37.4), (43.4, 46.4)]
DROPDOWN = (21.9, 23.2)


def beeps(dur, every=0.6, f=1150.0):
    """a reversing beeper"""
    n = int(dur * SR)
    out = [0.0] * n
    for k in range(n):
        u = k / SR
        on = (u % every) < 0.3
        out[k] = (0.6 * math.sin(2 * math.pi * f * u)) if on else 0.0
    return env_fade(out, 0.01, 0.05)


def spool(dur, f0=180.0, f1=1100.0, rise=3.0):
    """a jet's spool-up whine, then a steady idle"""
    n = int(dur * SR)
    out = [0.0] * n
    ph = 0.0
    no = bandnoise(n, lambda k: 900, q=0.5)
    for k in range(n):
        u = k / SR
        g = min(1.0, u / rise)
        f = f0 + (f1 - f0) * (1 - (1 - g) ** 2)
        ph += 2 * math.pi * f / SR
        out[k] = (0.35 * math.sin(ph) + 0.15 * math.sin(2.01 * ph)) * (0.3 + 0.7 * g) + 0.35 * no[k] * g
    return env_fade(out, 0.4, 0.8)


def score(mix, tl):
    for t in tl["clicks"]:
        mix.put(t - 0.02, click(2600, 0.02), 0.05, pan=0.3)
        mix.put(t + 0.06, blip(hz("E6"), 0.08, 0.04), 0.012, pan=0.3)
        mix.put(t + 0.05, airy(0.35, 1400, 2600, 0.6), 0.006, pan=0.4)
    # the dropdown: a soft open and close
    mix.put(DROPDOWN[0] + 0.05, blip(hz("B5"), 0.12, 0.05), 0.012, pan=0.5)
    mix.put(DROPDOWN[1] + 0.05, blip(hz("E6"), 0.12, 0.05), 0.012, pan=0.2)
    # camera glides between sites
    for a, b in GLIDES:
        mix.put(a, airy(b - a, 500, 1800, 0.6), 0.012)
    # B12: the high loader's hydraulics, the ULD on the rollers and onto the dolly
    mix.put(LOWER[0], hum(LOWER[1] - LOWER[0], 70, 1.0), 0.018, pan=0.2)
    mix.put(LOWER[0], hiss(LOWER[1] - LOWER[0], 1800), 0.006, pan=0.2)
    mix.put(SLIDE[0], rattle(SLIDE[1] - SLIDE[0], 22), 0.02, pan=0.2)
    mix.put(DROP[0], rattle(DROP[1] - DROP[0], 26), 0.02, pan=0.25)
    mix.put(DROP[1] - 0.05, thump(), 0.03, pan=0.25)
    # BT-14's run to Cargo C
    mix.put(GO[0], hum(GO[1] - GO[0], 150, 1.0), 0.016)
    # FL-02: out, lift, back with its beeper
    mix.put(FORK_OUT[0], hum(FORK_OUT[1] - FORK_OUT[0], 180, 1.0), 0.012, pan=-0.2)
    mix.put(FORK_LIFT[0], servo(FORK_LIFT[1] - FORK_LIFT[0], 300, 520), 0.01, pan=-0.2)
    mix.put(FORK_BACK[0], beeps(FORK_BACK[1] - FORK_BACK[0], 0.5, 1400), 0.008, pan=-0.2)
    # TRK-2205: diesel in, reverse beeper into D6, the shutter
    mix.put(TRUCK_IN[0], hum(TRUCK_IN[1] - TRUCK_IN[0], 60, 1.0), 0.02, pan=0.4)
    mix.put(TRUCK_BACK[0], beeps(TRUCK_BACK[1] - TRUCK_BACK[0], 0.6, 1150), 0.009, pan=0.4)
    mix.put(TRUCK_BACK[0], hum(TRUCK_BACK[1] - TRUCK_BACK[0], 55, 0.8), 0.016, pan=0.4)
    mix.put(D6[0], rattle(D6[1] - D6[0], 34), 0.018, pan=0.5)
    # B11: the bridge, the push, the engines through to the taxi
    mix.put(UNDOCK[0], servo(UNDOCK[1] - UNDOCK[0], 220, 360), 0.012, pan=-0.2)
    mix.put(PUSH[0], hum(PUSH[1] - PUSH[0], 95, 1.0), 0.018)
    mix.put(SPOOL[0], spool(TAXI[1] - SPOOL[0]), 0.012)
    # B10: catering's scissor lift
    mix.put(CATER_IN[0], hum(CATER_IN[1] - CATER_IN[0], 70, 0.8), 0.014, pan=-0.3)
    mix.put(CATER_LIFT[0], hum(CATER_LIFT[1] - CATER_LIFT[0], 85, 1.0), 0.016, pan=-0.3)
    mix.put(CATER_LIFT[0], hiss(CATER_LIFT[1] - CATER_LIFT[0], 1600), 0.005, pan=-0.3)
    mix.put(CATER_LIFT[1], click(700, 0.06), 0.04, pan=-0.3)
    # home: a soft chime as the whole pier comes into view
    mix.put(46.2, chime([hz("E5"), hz("B5"), hz("E6")], 1.6, 0.5), 0.008)
