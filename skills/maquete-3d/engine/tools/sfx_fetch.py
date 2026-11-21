"""Real recorded sounds from the Openverse API: CC0 only by default, so nothing needs a credit line.

    python tools/sfx_fetch.py "harbor ambience" --n 4 --max-dur 120
    python tools/sfx_fetch.py "seagull" --list

Each hit is downloaded (Freesound's hq preview mp3), its leading silence trimmed, and saved as 48 kHz mono wav next
to a credits.json (title, creator, license, landing page) in simulator-out/sfx/<query>/. A file is used only when
something points at it (tools/music.py --ambience, or a score). --license takes Openverse's codes (cc0, by, ...); anything but cc0 needs
the credit kept with the film.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

API = "https://api.openverse.org/v1/audio/"
UA = {"User-Agent": "sfx-fetch/1.0"}
FF = os.environ.get("FFMPEG", "ffmpeg")


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def search(q, license_, n, max_dur):
    params = {"q": q, "license": license_, "page_size": min(50, max(n * 3, 10))}
    data = json.loads(get(API + "?" + urllib.parse.urlencode(params)))
    hits = [r for r in data.get("results", []) if r.get("url") and (r.get("duration") or 0) <= max_dur * 1000]
    return hits[:n], data.get("result_count", 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("query")
    ap.add_argument("--n", type=int, default=6, help="how many sounds (default 6)")
    ap.add_argument("--max-dur", type=float, default=6.0, help="longest sound kept, seconds (default 6)")
    ap.add_argument("--license", default="cc0", help="Openverse license codes, comma-separated (default cc0)")
    ap.add_argument("--out", help="folder (default simulator-out/sfx/<query>)")
    ap.add_argument("--list", action="store_true", help="print the hits, download nothing")
    a = ap.parse_args()
    hits, total = search(a.query, a.license, a.n, a.max_dur)
    print(f"{total} results, {len(hits)} kept (<= {a.max_dur} s, license {a.license})")
    for i, r in enumerate(hits):
        print(f"  {i:02d}  {r.get('duration', 0) / 1000:5.1f} s  {r.get('license')}  {r.get('title')}")
    if a.list or not hits:
        return
    slug = re.sub(r"[^a-z0-9]+", "_", a.query.lower()).strip("_")
    out = a.out or os.path.join(os.environ.get("SIMULATOR_OUT", "simulator-out"), "sfx", slug)
    os.makedirs(out, exist_ok=True)
    credits = []
    for i, r in enumerate(hits):
        raw = os.path.join(out, f"{slug}_{i:02d}.src")
        wav = os.path.join(out, f"{slug}_{i:02d}.wav")
        try:
            open(raw, "wb").write(get(r["url"]))
        except Exception as e:  # one bad link never stops the rest
            print(f"  skip {i:02d}: {e}", file=sys.stderr)
            continue
        # leading silence off, 48 kHz mono, peak-safe
        subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", raw, "-af", "silenceremove=start_periods=1:start_threshold=-50dB,aresample=48000", "-ac", "1", wav], check=False)
        os.remove(raw)
        if os.path.exists(wav):
            credits.append({"file": os.path.basename(wav), "title": r.get("title"), "creator": r.get("creator"), "license": f"{r.get('license')} {r.get('license_version') or ''}".strip(), "source": r.get("source"), "page": r.get("foreign_landing_url"), "id": r.get("id")})
    json.dump(credits, open(os.path.join(out, "credits.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"wrote {len(credits)} wav + credits.json to {out}")


if __name__ == "__main__":
    main()
