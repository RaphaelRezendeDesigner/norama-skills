#!/bin/bash
# Uso: assistir.sh <link-do-instagram | arquivo-de-video> [mais links...]
# Saída: uma pasta por vídeo com info.txt, quadros_NN.jpg, transcricao.txt, video.mp4
DIR="$(cd "$(dirname "$0")" && pwd)"
BASE="${ASSISTIR_DIR:-${TMPDIR:-/tmp}/assistir}"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"
export HF_HUB_DISABLE_XET=1

command -v ffmpeg >/dev/null || { echo "ERRO: ffmpeg não instalado (apt-get install -y ffmpeg)"; exit 1; }
python3 -c "import faster_whisper" 2>/dev/null || pip install -q faster-whisper >/dev/null 2>&1 \
  || echo "AVISO: não consegui instalar faster-whisper; sigo sem transcrição"

for alvo in "$@"; do
  if [ -f "$alvo" ]; then
    id="arquivo_$(basename "$alvo" | tr -c 'A-Za-z0-9._-' '_')"
    D="$BASE/$id"; mkdir -p "$D"; cp "$alvo" "$D/video.mp4"
    echo "Arquivo local: $alvo" > "$D/info.txt"
  else
    id=$(echo "$alvo" | sed -nE 's#.*instagram\.com/(reel|reels|p|tv)/([A-Za-z0-9_-]+).*#\2#p')
    [ -z "$id" ] && { echo "== $alvo: link não reconhecido (só Instagram ou arquivo local)"; continue; }
    D="$BASE/$id"; mkdir -p "$D"
    curl -sS -L -A "$UA" -o "$D/embed.html" "https://www.instagram.com/reel/$id/embed/captioned/" \
      || { echo "== $id: falha ao abrir www.instagram.com"; continue; }
    url=$(python3 -I "$DIR/extrai.py" "$D/embed.html" "$D/info.txt")
    if [ -z "$url" ]; then
      echo "== $id: vídeo não disponível (privado/removido/bloqueado). Legenda em $D/info.txt"; continue
    fi
    if ! curl -sS -L -o "$D/video.mp4" "$url" 2>"$D/curl.err"; then
      host=$(echo "$url" | sed -E 's#https?://([^/]+)/.*#\1#')
      echo "== $id: download BLOQUEADO para o host: $host  ($(tail -1 "$D/curl.err"))"
      echo "   -> libere esse host no ambiente (update_environment add_allowed_hosts) e rode de novo"
      continue
    fi
  fi
  rm -f "$D"/quadros_*.jpg
  ffmpeg -loglevel error -y -i "$D/video.mp4" -vf "fps=1/3,scale=480:-1,tile=4x2" "$D/quadros_%02d.jpg"
  ffmpeg -loglevel error -y -i "$D/video.mp4" -ac 1 -ar 16000 -f wav "$D/audio.wav"
  if python3 -c "import faster_whisper" 2>/dev/null; then
    python3 -I "$DIR/transcreve.py" "$D/audio.wav" > "$D/transcricao.txt" 2>"$D/transcreve.err" \
      || { echo "(transcrição falhou: $(tail -1 "$D/transcreve.err"))" > "$D/transcricao.txt"; }
  else
    echo "(sem transcrição: faster-whisper indisponível)" > "$D/transcricao.txt"
  fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$D/video.mp4" | cut -d. -f1)
  echo "== $id: OK ${dur}s | pasta: $D | $(ls "$D"/quadros_*.jpg | wc -l) mosaicos de quadros"
done
