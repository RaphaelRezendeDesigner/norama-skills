"""Lê a página de incorporação do Instagram: grava autor/legenda em info.txt e imprime a URL do vídeo."""
import html
import re
import sys

s = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
info = []
u = re.search(r'class="UsernameText"[^>]*>(.*?)<', s)
info.append("Autor: @" + (u.group(1) if u else "?"))
c = re.search(r'class="Caption"[^>]*>(.*?)</div>', s, re.S)
if c:
    txt = html.unescape(re.sub(r"<[^>]+>", " ", c.group(1)))
    info.append("Legenda: " + re.sub(r"\s+", " ", txt).strip())
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(info) + "\n")

v = re.search(r'video_url\\*"\s*:\s*\\*"(.*?)\\*"', s)
if v:
    print(v.group(1).replace("\\", "").replace("u0026", "&"))
