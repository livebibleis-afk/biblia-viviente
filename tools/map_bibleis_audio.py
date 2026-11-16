#!/usr/bin/env python3
"""Mapea nombres de Bible.is / Faith Comes By Hearing
a la ruta del lector: audio/<version>/<libro-2d>/<capitulo-3d>.mp3

Ejemplos de entrada:
  B01___01_San_Mateo___SPANTVN2DA.mp3  -> audio/spantv/40/001.mp3
  A01___01_Genesis_____SPNDAAFO3DA.mp3 -> audio/spndaaf/01/001.mp3

Uso (solo archivos locales; no toca Google Drive):
  python3 map_bibleis_audio.py --dry-run --scan /ruta/con/mp3
  python3 map_bibleis_audio.py --dry-run --list nombres.txt
  python3 map_bibleis_audio.py --apply --scan /ruta --dest /ruta/salida

El modo --apply copia (no borra el original). Capítulo 00 (carátulas) se omite.
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

# Códigos DAM de Bible.is vistos en el Drive del usuario → carpeta de versión
DAM_TO_VERSION = {
    "SPNNVIN2DA": "nvi",         # NVI dramatizada NT (copyright Biblica)
    "SPNR95N2DA": "rvr1995",     # Reina-Valera 1995 dramatizada NT
    "SPANTVN2DA": "spantv",      # NTV dramatizada (copyright Tyndale)
    "SPNDAAFO3DA": "spndaaf",    # Narración Dr. Armando Alducin F.
    "ESDAAFO1": "esdaaf",
    "ESDAAFO1D": "esdaaf",
    "ESDAAFO1DA": "esdaaf",
}

# A01–A39 = AT (libros 1–39); B01–B27 = NT (libros 40–66)
# C01–C27 se trata igual que B (NT), por si la colección usa prefijo C.
PREFIX_TO_OFFSET = {"A": 0, "B": 39, "C": 39}

# El relleno de guiones bajos antes del código DAM varía (a veces uno solo, p. ej. Apocalipsis).
NAME_RE = re.compile(
    r"(?P<prefix>[A-Ca-c])(?P<book>\d{2})_{2,3}(?P<chapter>\d{2})"
    r"(?:\((?P<part>\d+)\))?"
    r"_(?P<label>.*?)_+(?P<dam>[A-Za-z]{3}[A-Za-z0-9]+)\.(?P<ext>mp3|m4a|ogg|MP3|M4A|OGG)$"
)


def map_filename(name: str) -> dict | None:
    m = NAME_RE.search(Path(name).name)
    if not m:
        return None
    prefix = m.group("prefix").upper()
    book_in_group = int(m.group("book"))
    chapter = int(m.group("chapter"))
    dam = m.group("dam").upper()
    ext = m.group("ext").lower()
    offset = PREFIX_TO_OFFSET.get(prefix)
    if offset is None:
        return None
    book_num = offset + book_in_group
    if book_num < 1 or book_num > 66:
        return None
    version = DAM_TO_VERSION.get(dam, dam.lower())
    skip = chapter == 0  # carátula / intro, no es un capítulo
    dest = f"audio/{version}/{book_num:02d}/{chapter:03d}.{ext}"
    return {
        "source": Path(name).name,
        "dam": dam,
        "version": version,
        "book": book_num,
        "chapter": chapter,
        "part": m.group("part"),
        "dest": dest,
        "skip": skip,
        "reason": "capitulo 00 (carátula)" if skip else None,
    }


def iter_sources(scan: Path | None, list_file: Path | None):
    if list_file:
        for line in list_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                yield Path(line)
    if scan:
        for p in sorted(scan.rglob("*")):
            if p.is_file() and p.suffix.lower() in {".mp3", ".m4a", ".ogg"}:
                yield p


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scan", type=Path, help="Carpeta local a recorrer")
    parser.add_argument("--list", dest="list_file", type=Path, help="Archivo de texto con un nombre por línea")
    parser.add_argument("--dest", type=Path, default=Path("."), help="Raíz de salida para --apply (debe contener audio/)")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Solo imprime el mapeo (predeterminado)")
    parser.add_argument("--apply", action="store_true", help="Copia los archivos al destino")
    args = parser.parse_args(argv)
    if args.apply:
        args.dry_run = False
    if not args.scan and not args.list_file:
        parser.print_help()
        print("\nDemo:")
        samples = [
            "B01___01_San_Mateo___SPNNVIN2DA.mp3",
            "B01___01_San_Mateo___SPANTVN2DA.mp3",
            "B04___01_San_Juan____SPANTVN2DA.mp3",
            "A01___01_Genesis_____SPNDAAFO3DA.mp3",
            "A19___23_Salmos______SPNDAAFO3DA.mp3",
            "B27___22_Apocalipsis_SPNNVIN2DA.mp3",
            "B01___01_San_Mateo___SPNR95N2DA.mp3",
            "C07___00_Dr_Armando_Alducin_F_____SPNDAAFO3DA.jpeg",
        ]
        for s in samples:
            r = map_filename(s)
            print(f"  {s}")
            print(f"    -> {r['dest'] if r and not r['skip'] else (r['reason'] if r else 'sin mapeo')}")
        return 0

    mapped = skipped = unknown = 0
    for src in iter_sources(args.scan, args.list_file):
        result = map_filename(src.name)
        if not result:
            unknown += 1
            print(f"?  {src.name}")
            continue
        if result["skip"]:
            skipped += 1
            print(f"-  {src.name}  ({result['reason']})")
            continue
        mapped += 1
        print(f"{'copy' if args.apply else 'ok '} {src.name}  ->  {result['dest']}")
        if args.apply:
            dest = args.dest / result["dest"]
            dest.parent.mkdir(parents=True, exist_ok=True)
            if src.exists():
                shutil.copy2(src, dest)
    print(f"\nMapeados: {mapped}  Omitidos: {skipped}  Sin patrón: {unknown}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
