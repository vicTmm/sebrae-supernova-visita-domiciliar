"""Gera os ícones PNG da PWA a partir do SVG. Requer resvg-py."""

from pathlib import Path

from resvg_py import svg_to_bytes


public = Path(__file__).resolve().parents[1] / "public"
source = (public / "icon.svg").read_text(encoding="utf-8")

for size in (192, 512):
    png = svg_to_bytes(svg_string=source, width=size, height=size)
    (public / f"icon-{size}.png").write_bytes(bytes(png))
