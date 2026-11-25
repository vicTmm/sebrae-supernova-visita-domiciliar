#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")/.."

# Narração determinística: voz Rocko (pt_BR, masculina), ritmo lento e tratamento "distante".
Voz="Rocko"
Taxa=160
Bruto="/tmp/visitario-narracao-rocko.aiff"

say -v "$Voz" -r "$Taxa" -f roteiro.txt -o "$Bruto"
ffmpeg -y -loglevel error -i "$Bruto" \
  -af "lowpass=f=3400,aecho=0.8:0.88:55|110:0.22|0.10,volume=0.95" \
  -ac 1 -ar 48000 -c:a pcm_s16le narracao.wav
cp narracao.wav public/narracao.wav

ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 narracao.wav
