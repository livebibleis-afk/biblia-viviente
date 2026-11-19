#!/usr/bin/env python3
"""Descarga, etiqueta y cataloga el podcast de Biblia Viviente.

Los MP3 no se guardan en git. El audio vive como asset del GitHub Release
`podcast`. En el repositorio solo quedan el CSV, el JSON, el estado y el RSS.

Uso típico (desde cualquier directorio, las rutas son relativas a la raíz):

    python3 tools/podcast/tag_podcast.py --metadata-only
    python3 tools/podcast/tag_podcast.py --upload
    python3 tools/podcast/tag_podcast.py --substitute-audio ./prueba.mp3 --only ARCHIVO.mp3
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SLUG = "livebibleis-afk/biblia-viviente"
RELEASE_TAG = "podcast"

COLUMNS = [
    "archivo",
    "titulo",
    "artista",
    "album",
    "anio",
    "pista",
    "genero",
    "comentarios",
    "disco",
    "compositor",
    "artista_album",
    "caratula",
    "serie",
    "codigo_serie",
    "source_url",
    "resumen",
    "temas",
    "referencias",
    "titulo_sugerido",
]

SPEAKER_PREFIX = "DAAF_Armando_Alducin_F"
FILENAME_RE = re.compile(rf"^{re.escape(SPEAKER_PREFIX)}_[A-Z0-9]+_\d{{2}}\.mp3$")

DEFAULTS = {
    "artista": "Dr. Armando Alducin F.",
    "genero": "@BibliaViviente",
    "compositor": "@BibliaViviente",
    "artista_album": "@BibliaViviente",
    "caratula": "@BibliaViviente Dr. AAF",
}

PODCAST_TITLE = "@BibliaViviente · Dr. Armando Alducin F."
PODCAST_AUTHOR = "Dr. Armando Alducin F."
PODCAST_OWNER = "@BibliaViviente"
PODCAST_DESCRIPTION = (
    "Enseñanzas y reportajes del Dr. Armando Alducin F. "
    "Biblia App Lee.Oye.Ve — @BibliaViviente."
)

ITUNES = "http://www.itunes.com/dtds/podcast-1.0.dtd"
ATOM = "http://www.w3.org/2005/Atom"
CONTENT = "http://purl.org/rss/1.0/modules/content/"

HEADER_ALIASES = {
    "archivo": "archivo",
    "file": "archivo",
    "filename": "archivo",
    "titulo": "titulo",
    "título": "titulo",
    "title": "titulo",
    "artista": "artista",
    "artist": "artista",
    "album": "album",
    "álbum": "album",
    "anio": "anio",
    "año": "anio",
    "year": "anio",
    "pista": "pista",
    "track": "pista",
    "genero": "genero",
    "género": "genero",
    "genre": "genero",
    "comentarios": "comentarios",
    "comentario": "comentarios",
    "comments": "comentarios",
    "disco": "disco",
    "disco_no": "disco",
    "discono": "disco",
    "disc": "disco",
    "compositor": "compositor",
    "composer": "compositor",
    "artista_album": "artista_album",
    "artista_del_album": "artista_album",
    "artista_del_álbum": "artista_album",
    "album_artist": "artista_album",
    "albumartist": "artista_album",
    "caratula": "caratula",
    "carátula": "caratula",
    "cover": "caratula",
    "serie": "serie",
    "series": "serie",
    "codigo_serie": "codigo_serie",
    "código_serie": "codigo_serie",
    "codigo": "codigo_serie",
    "series_code": "codigo_serie",
    "source_url": "source_url",
    "url": "source_url",
    "enlace": "source_url",
    "fuente": "source_url",
    "origen": "source_url",
    "resumen": "resumen",
    "summary": "resumen",
    "temas": "temas",
    "topics": "temas",
    "referencias": "referencias",
    "refs": "referencias",
    "titulo_sugerido": "titulo_sugerido",
    "título_sugerido": "titulo_sugerido",
}

BOOKS = [
    "Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio", "Josué", "Jueces", "Rut",
    "1 Samuel", "2 Samuel", "1 Reyes", "2 Reyes", "1 Crónicas", "2 Crónicas", "Esdras",
    "Nehemías", "Ester", "Job", "Salmos", "Proverbios", "Eclesiastés", "Cantares", "Isaías",
    "Jeremías", "Lamentaciones", "Ezequiel", "Daniel", "Oseas", "Joel", "Amós", "Abdías",
    "Jonás", "Miqueas", "Nahúm", "Habacuc", "Sofonías", "Hageo", "Zacarías", "Malaquías",
    "Mateo", "Marcos", "Lucas", "Juan", "Hechos", "Romanos", "1 Corintios", "2 Corintios",
    "Gálatas", "Efesios", "Filipenses", "Colosenses", "1 Tesalonicenses", "2 Tesalonicenses",
    "1 Timoteo", "2 Timoteo", "Tito", "Filemón", "Hebreos", "Santiago", "1 Pedro", "2 Pedro",
    "1 Juan", "2 Juan", "3 Juan", "Judas", "Apocalipsis",
]

STOPWORDS = {
    "para", "como", "donde", "cuando", "porque", "esta", "este", "esto", "estos", "estas",
    "desde", "hasta", "sobre", "entre", "tambien", "pero", "aunque", "hacia", "tiene",
    "tienen", "haber", "hacer", "siendo", "sido", "puede", "pueden", "cada", "todo",
    "toda", "todos", "todas", "otro", "otra", "otros", "otras", "solo", "sola", "mismo",
    "misma", "muy", "mas", "menos", "bien", "quien", "cual", "cuales", "despues", "antes",
    "ahora", "aqui", "alli", "entonces", "siempre", "nunca", "algo", "nada", "alguien",
    "nadie", "nuestro", "nuestra", "nuestros", "nuestras", "usted", "ustedes", "ellos",
    "ellas", "nosotros", "vosotros", "dios", "señor", "senor", "jesus", "jesús", "cristo",
}


class DownloadError(RuntimeError):
    """La fuente no pudo convertirse en un MP3."""


def strip_accents(text: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFD", text or "") if unicodedata.category(ch) != "Mn"
    )


def clean_text(value: str) -> str:
    text = (value or "").replace("\u00a0", " ").replace("\ufeff", "")
    return re.sub(r"\s+", " ", text).strip()


def header_key(name: str) -> str:
    raw = clean_text(name).lower().replace(" ", "_")
    raw = raw.replace("á", "á")
    folded = strip_accents(raw)
    return HEADER_ALIASES.get(raw) or HEADER_ALIASES.get(folded) or ""


def parse_track(value: str) -> int:
    match = re.search(r"\d+", clean_text(value).rstrip(";"))
    return int(match.group()) if match else 1


def parse_year(value: str) -> int | None:
    match = re.search(r"\d{4}", clean_text(value))
    return int(match.group()) if match else None


def split_list(value: str) -> list[str]:
    parts = re.split(r"[;\n|]", value or "")
    found: list[str] = []
    for part in parts:
        item = clean_text(part)
        if item and item not in found:
            found.append(item)
    return found


def safe_filename(name: str) -> str:
    base = Path(clean_text(name)).name
    if not base or base in {".", ".."} or "/" in name or "\\" in name:
        raise ValueError(f"Nombre de archivo no válido: {name!r}")
    if not base.lower().endswith(".mp3"):
        base += ".mp3"
    return base


def build_filename(row: dict) -> str:
    explicit = clean_text(row.get("archivo", ""))
    if explicit and explicit not in {"-", "—"}:
        return safe_filename(explicit)
    code = re.sub(r"[^A-Za-z0-9]", "", clean_text(row.get("codigo_serie", ""))).upper() or "SERIE"
    track = parse_track(row.get("pista", ""))
    return f"{SPEAKER_PREFIX}_{code}_{track:02d}.mp3"


def blank_row(row: dict) -> bool:
    values = [clean_text(v) for v in row.values()]
    useful = [v for v in values if v and v not in {"-", "—"}]
    return not useful


def normalize_row(raw: dict) -> dict:
    row = {column: "" for column in COLUMNS}
    for key, value in raw.items():
        column = header_key(str(key))
        if column:
            row[column] = clean_text(str(value))
    if blank_row(row):
        return {}
    if row["titulo"] in {"", "-", "—"} and row["archivo"] in {"", "-", "—"}:
        return {}
    for key, default in DEFAULTS.items():
        if not row[key] or row[key] in {"-", "—"}:
            row[key] = default
    serie = row["serie"]
    if not serie or serie in {"-", "—"}:
        serie = re.sub(r"\s*[\(\|].*$", "", row["titulo"]).strip() or row["titulo"]
        row["serie"] = serie
    if not row["album"] or row["album"] in {"-", "—"} or "corregir" in row["album"].lower():
        row["album"] = f"@BibliaViviente Dr. AAF {serie}".strip()
    if not row["codigo_serie"] or row["codigo_serie"] in {"-", "—"}:
        letters = re.sub(r"[^A-Za-z0-9]", "", strip_accents(serie)).upper()
        row["codigo_serie"] = (letters[:4] or "SERIE")
    row["archivo"] = build_filename(row)
    row["pista"] = str(parse_track(row["pista"]))
    year = parse_year(row["anio"])
    row["anio"] = str(year) if year else ""
    if row["source_url"] in {"-", "—"}:
        row["source_url"] = ""
    row["source_url"] = row["source_url"].split("?")[0].strip()
    if row["disco"] in {"-", "—"}:
        row["disco"] = ""
    return row


def parse_manifest_text(text: str) -> list[dict]:
    sample = text.lstrip("\ufeff")
    if "titulo" not in sample.lower() and "título" not in sample.lower() and "title" not in sample.lower():
        raise ValueError(
            "El CSV no tiene columna de título. "
            "Usa los encabezados de data/podcast/episodes.csv."
        )
    reader = csv.DictReader(sample.splitlines())
    if not reader.fieldnames:
        raise ValueError("El CSV está vacío.")
    episodes: list[dict] = []
    seen: set[str] = set()
    for raw in reader:
        episode = normalize_row(raw)
        if not episode:
            continue
        if episode["archivo"] in seen:
            raise ValueError(f"Archivo repetido en el manifiesto: {episode['archivo']}")
        seen.add(episode["archivo"])
        episodes.append(episode)
    if not episodes:
        raise ValueError("El manifiesto no tiene episodios.")
    return episodes


def read_manifest(path: Path) -> list[dict]:
    return parse_manifest_text(path.read_text(encoding="utf-8-sig"))


def write_manifest(path: Path, episodes: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        for episode in episodes:
            writer.writerow({column: episode.get(column, "") for column in COLUMNS})


def merge_sheet(existing: list[dict], incoming: list[dict]) -> list[dict]:
    """La hoja manda en las etiquetas. Se conservan sugerencias locales si la hoja las deja vacías."""
    previous = {episode["archivo"]: episode for episode in existing}
    merged: list[dict] = []
    keep = ("resumen", "temas", "referencias", "titulo_sugerido")
    for episode in incoming:
        old = previous.get(episode["archivo"], {})
        for column in keep:
            if not episode.get(column) and old.get(column):
                episode[column] = old[column]
        merged.append(episode)
    return merged


def download_sheet(url: str) -> str:
    request = Request(url, headers={"User-Agent": "BibliaVivientePodcast/1.0"})
    try:
        with urlopen(request, timeout=30) as response:
            payload = response.read(2_000_001)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise DownloadError(f"No se pudo leer la hoja publicada: {exc}") from exc
    if len(payload) > 2_000_000:
        raise DownloadError("La hoja publicada pesa más de 2 MB; no parece un CSV de episodios.")
    return payload.decode("utf-8-sig")


def resolve_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return ROOT / path


def detect_repo_slug() -> str:
    try:
        url = subprocess.check_output(
            ["git", "remote", "get-url", "origin"],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return DEFAULT_SLUG
    match = re.search(r"github\.com[:/]([^/\s]+)/([^/\s]+?)(?:\.git)?$", url)
    if not match:
        return DEFAULT_SLUG
    return f"{match.group(1)}/{match.group(2)}"


def repo_urls(slug: str) -> tuple[str, str]:
    owner, repo = slug.split("/", 1)
    site = f"https://{owner}.github.io/{repo}"
    audio = f"https://github.com/{slug}/releases/download/{RELEASE_TAG}"
    return site, audio


def load_state(path: Path) -> dict:
    if not path.exists():
        return {"version": 1, "episodes": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"No pude leer {path}: {exc}") from exc
    data.setdefault("version", 1)
    data.setdefault("episodes", {})
    return data


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hms(seconds: float | None) -> str:
    if seconds is None:
        return ""
    total = max(0, int(round(seconds)))
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def public_site_url(site: str, path: Path) -> str:
    try:
        relative = path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        relative = "data/podcast/cover.jpg"
    return site.rstrip("/") + "/" + relative


def audio_url(base: str, filename: str) -> str:
    return base.rstrip("/") + "/" + filename


def cover_is_image(value: str) -> bool:
    return Path(value).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}


def episode_cover(episode: dict, default_cover: Path) -> Path | None:
    raw = episode.get("caratula", "")
    if cover_is_image(raw):
        candidate = resolve_path(raw)
        if candidate.exists():
            return candidate
    return default_cover if default_cover.exists() else None


def write_id3(path: Path, episode: dict, cover: Path | None) -> None:
    try:
        from mutagen.id3 import APIC, COMM, ID3, ID3NoHeaderError, TALB, TCOM, TCON, TDRC, TIT2, TPE1, TPE2, TPOS, TRCK, TXXX, WXXX
    except ImportError as exc:
        raise SystemExit(
            "Falta el paquete mutagen. Instálalo con:\n"
            "  pip install -r tools/podcast/requirements.txt"
        ) from exc

    try:
        tags = ID3(path)
    except ID3NoHeaderError:
        tags = ID3()
    tags.clear()
    tags.add(TIT2(encoding=3, text=episode["titulo"]))
    tags.add(TPE1(encoding=3, text=episode["artista"]))
    tags.add(TALB(encoding=3, text=episode["album"]))
    if episode.get("fecha") or episode.get("anio"):
        tags.add(TDRC(encoding=3, text=str(episode.get("fecha") or episode["anio"])))
    tags.add(TRCK(encoding=3, text=str(parse_track(episode.get("pista", "1")))))
    tags.add(TCON(encoding=3, text=episode["genero"]))
    if episode.get("comentarios"):
        tags.add(COMM(encoding=3, lang="spa", desc="", text=episode["comentarios"]))
    if episode.get("disco"):
        tags.add(TPOS(encoding=3, text=str(episode["disco"])))
    tags.add(TCOM(encoding=3, text=episode["compositor"]))
    tags.add(TPE2(encoding=3, text=episode["artista_album"]))
    if episode.get("source_url"):
        tags.add(WXXX(encoding=3, desc="source", url=episode["source_url"]))
    if episode.get("serie"):
        tags.add(TXXX(encoding=3, desc="SERIE", text=episode["serie"]))
    if cover and cover.exists():
        payload = cover.read_bytes()
        mime = "image/png" if cover.suffix.lower() == ".png" else "image/jpeg"
        description = episode.get("caratula") or "Cover"
        if cover_is_image(description):
            description = "@BibliaViviente Dr. AAF"
        tags.add(APIC(encoding=3, mime=mime, type=3, desc=description, data=payload))
    tags.save(path, v2_version=4)


def probe_duration(path: Path) -> float:
    from mutagen.mp3 import MP3

    return float(MP3(path).info.length or 0)


def find_tool(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    candidate = Path.home() / ".local" / "bin" / name
    if candidate.is_file():
        return str(candidate)
    return None


def run_command(command: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(command, capture_output=True, text=True)


def friendly_download_error(detail: str) -> str:
    text = " ".join((detail or "").split())
    lowered = text.lower()
    blocked = any(
        token in lowered
        for token in ("sign in", "not a bot", "403", "forbidden", "unavailable", "blocked", "captcha")
    )
    local = "python3 tools/podcast/tag_podcast.py --upload"
    if blocked:
        return (
            "No se pudo descargar el audio: YouTube bloqueó la petición. "
            "Es habitual en los servidores de GitHub. En tu computadora corre: " + local
        )
    short = text[:400] or "yt-dlp no devolvió detalle."
    return f"No se pudo descargar el audio: {short} Respaldo local: {local}"


def download_source(url: str, dest_dir: Path, cookies: str = "") -> Path:
    if url.startswith("file://"):
        source = Path(url[7:])
        if not source.exists():
            raise DownloadError(f"No existe el archivo local {source}")
        target = dest_dir / source.name
        dest_dir.mkdir(parents=True, exist_ok=True)
        if source.resolve() != target.resolve():
            shutil.copy(source, target)
        return target
    local = Path(url)
    if local.is_file():
        return local

    binary = find_tool("yt-dlp")
    if not binary:
        raise DownloadError(
            "yt-dlp no está instalado. Instálalo con: pip install -r tools/podcast/requirements.txt"
        )
    dest_dir.mkdir(parents=True, exist_ok=True)
    for old in dest_dir.iterdir():
        if old.is_file():
            old.unlink()
    command = [
        binary,
        "--no-playlist",
        "-f",
        "bestaudio/best",
        "-o",
        str(dest_dir / "source.%(ext)s"),
        "--no-progress",
        "--retries",
        "2",
        "--fragment-retries",
        "2",
        "--socket-timeout",
        "30",
        url,
    ]
    if cookies:
        command[1:1] = ["--cookies", cookies]
    completed = run_command(command)
    if completed.returncode != 0:
        raise DownloadError(friendly_download_error(completed.stderr or completed.stdout))
    files = [item for item in dest_dir.iterdir() if item.is_file() and not item.name.endswith(".part")]
    if not files:
        raise DownloadError(friendly_download_error("yt-dlp terminó sin archivo."))
    return max(files, key=lambda item: item.stat().st_mtime)


def fetch_upload_date(url: str, cookies: str = "") -> str:
    """Fecha de subida del video (YYYY-MM-DD) según yt-dlp, o "" si no se puede."""
    if not url or not url.startswith("http"):
        return ""
    binary = find_tool("yt-dlp")
    if not binary:
        return ""
    command = [binary, "--skip-download", "--no-playlist", "--print", "%(upload_date)s", url]
    if cookies:
        command[1:1] = ["--cookies", cookies]
    completed = run_command(command)
    value = (completed.stdout or "").strip().splitlines()
    value = value[-1] if value else ""
    if not re.fullmatch(r"\d{8}", value):
        return ""
    return f"{value[:4]}-{value[4:6]}-{value[6:]}"


def disco_from_date(date: str) -> str:
    """«Disco no» de 6 dígitos: AADDMM (la plantilla usa AAAADDMM, p. ej. 20151407 = 14/07/2015)."""
    year, month, day = date.split("-")
    return f"{year[2:]}{day}{month}"


def apply_upload_date(episode: dict, entry: dict, date: str) -> None:
    if not date:
        return
    entry["upload_date"] = date
    episode["fecha"] = date
    episode["anio"] = date[:4]
    episode["disco"] = disco_from_date(date)


def convert_to_mp3(source: Path, dest: Path) -> None:
    binary = find_tool("ffmpeg")
    if not binary:
        raise DownloadError("ffmpeg no está instalado. En Debian/Ubuntu: sudo apt-get install ffmpeg")
    dest.parent.mkdir(parents=True, exist_ok=True)
    command = [
        binary,
        "-y",
        "-i",
        str(source),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "44100",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        str(dest),
    ]
    completed = run_command(command)
    if completed.returncode != 0 or not dest.exists() or dest.stat().st_size < 128:
        tail = " ".join((completed.stderr or "").split())[-400:]
        raise DownloadError(f"ffmpeg no pudo crear el MP3. {tail}")


def book_pattern() -> re.Pattern:
    aliases = {strip_accents(name).lower(): name for name in BOOKS}
    aliases["salmo"] = "Salmos"
    aliases["apocalipsis"] = "Apocalipsis"
    ordered = sorted(aliases, key=len, reverse=True)
    expression = r"\b(" + "|".join(re.escape(name) for name in ordered) + r")\s+(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?"
    book_pattern.aliases = aliases  # type: ignore[attr-defined]
    return re.compile(expression, re.IGNORECASE)


def extract_references(text: str) -> list[str]:
    pattern = book_pattern()
    aliases = book_pattern.aliases  # type: ignore[attr-defined]
    found: list[str] = []
    for match in pattern.finditer(strip_accents(text)):
        book = aliases.get(match.group(1).lower(), match.group(1))
        ref = f"{book} {int(match.group(2))}"
        if match.group(3):
            ref += f":{int(match.group(3))}"
        if ref not in found:
            found.append(ref)
    return found


def extract_topics(text: str, limit: int = 6) -> list[str]:
    counts: dict[str, int] = {}
    blocked = {strip_accents(name).lower() for name in BOOKS}
    blocked |= STOPWORDS
    for token in re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{5,}", text or ""):
        key = strip_accents(token).lower()
        if key in blocked:
            continue
        counts[key] = counts.get(key, 0) + 1
    ranking = sorted(counts, key=lambda item: (-counts[item], item))
    original = {}
    for token in re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{5,}", text or ""):
        original.setdefault(strip_accents(token).lower(), token)
    return [original.get(key, key).capitalize() for key in ranking[:limit]]


def summarize(text: str, limit: int = 480) -> str:
    compact = clean_text(text)
    if not compact:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", compact)
    chosen = " ".join(sentences[:2]).strip()
    if len(chosen) > limit:
        chosen = chosen[: limit - 1].rstrip() + "…"
    return chosen


def suggest_title(text: str) -> str:
    compact = clean_text(text)
    if len(compact) < 12:
        return ""
    sentence = re.split(r"(?<=[.!?])\s+", compact)[0]
    sentence = sentence.strip(" -–—")
    if len(sentence) > 90:
        sentence = sentence[:89].rstrip() + "…"
    return sentence


def chapters_from_segments(segments: list[dict], window: int = 300) -> list[dict]:
    if not segments:
        return []
    chapters: list[dict] = []
    bucket_start = 0.0
    bucket_text = ""
    for segment in segments:
        start = float(segment.get("start") or 0)
        text = clean_text(segment.get("text", ""))
        if not bucket_text:
            bucket_start = start
            bucket_text = text
            continue
        if start >= bucket_start + window and text:
            chapters.append({"start": round(bucket_start, 1), "title": suggest_title(bucket_text) or "Capítulo"})
            bucket_start = start
            bucket_text = text
        elif text:
            bucket_text = (bucket_text + " " + text).strip()
    if bucket_text:
        chapters.append({"start": round(bucket_start, 1), "title": suggest_title(bucket_text) or "Capítulo"})
    return chapters


def transcribe_file(path: Path, model_name: str) -> list[dict]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise SystemExit(
            "La transcripción necesita faster-whisper y no está instalado.\n"
            "  pip install faster-whisper\n"
            "Es opcional porque en CI es lento. Sin --transcribe la herramienta no lo usa."
        ) from exc
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    options = {"language": "es", "beam_size": 1}

    def consume(use_vad: bool) -> list[dict]:
        iterator, _info = model.transcribe(str(path), vad_filter=use_vad, **options)
        return [
            {"start": float(item.start), "end": float(item.end), "text": (item.text or "").strip()}
            for item in iterator
        ]

    try:
        return consume(True)
    except Exception as exc:
        if any(token in str(exc).lower() for token in ("vad", "onnx", "silero")):
            return consume(False)
        raise


def apply_suggestions(episode: dict, segments: list[dict], transcript_path: Path) -> bool:
    text = " ".join(segment["text"] for segment in segments if segment.get("text"))
    transcript_path.parent.mkdir(parents=True, exist_ok=True)
    transcript_path.write_text(text.strip() + "\n", encoding="utf-8")
    changed = False
    summary = summarize(text)
    topics = "; ".join(extract_topics(text))
    references = "; ".join(extract_references(text))
    title = suggest_title(text)
    if summary and not episode.get("resumen"):
        episode["resumen"] = summary
        changed = True
    if topics and not episode.get("temas"):
        episode["temas"] = topics
        changed = True
    if references and not episode.get("referencias"):
        episode["referencias"] = references
        changed = True
    if title and not episode.get("titulo_sugerido"):
        episode["titulo_sugerido"] = title
        changed = True
    episode["_chapters"] = chapters_from_segments(segments)
    return changed


def empty_entry(episode: dict) -> dict:
    status = "sin_fuente" if not episode.get("source_url") else "pendiente"
    return {
        "status": status,
        "error": "",
        "audio_url": "",
        "duration_seconds": None,
        "bytes": None,
        "sha256": "",
        "source_url": episode.get("source_url", ""),
        "processed_at": None,
        "chapters": [],
    }


def reconcile_entries(episodes: list[dict], state: dict) -> None:
    files = state.setdefault("episodes", {})
    known = set()
    for episode in episodes:
        known.add(episode["archivo"])
        current = files.get(episode["archivo"]) or empty_entry(episode)
        current["source_url"] = episode.get("source_url", "")
        if current.get("status") == "publicado" and current.get("audio_url"):
            files[episode["archivo"]] = current
            continue
        if not episode.get("source_url") and current.get("status") != "etiquetado":
            current["status"] = "sin_fuente"
        elif current.get("status") not in {"etiquetado", "error_descarga", "publicado"}:
            current["status"] = "pendiente"
        files[episode["archivo"]] = current
    for name in list(files):
        if name not in known:
            del files[name]


def filename_warnings(episode: dict) -> list[str]:
    warnings = []
    if not FILENAME_RE.match(episode["archivo"]):
        warnings.append(
            f"{episode['archivo']} no sigue el patrón {SPEAKER_PREFIX}_CODIGO_01.mp3"
        )
    disco = episode.get("disco", "")
    if disco and not re.fullmatch(r"\d{6}", disco):
        warnings.append(
            f"{episode['archivo']}: disco «{disco}» no tiene 6 dígitos. Se etiqueta tal cual."
        )
    return warnings


def gh_bin() -> str:
    binary = find_tool("gh")
    if not binary:
        raise RuntimeError("No está el comando gh. Instala GitHub CLI y autentícate, o exporta GH_TOKEN.")
    return binary


def gh_release_exists(tag: str) -> bool:
    completed = run_command([gh_bin(), "release", "view", tag])
    return completed.returncode == 0


def ensure_release(tag: str) -> None:
    if gh_release_exists(tag):
        return
    notes = (
        "Audio del podcast de Biblia Viviente (Dr. Armando Alducin F.).\n\n"
        "Estos MP3 no van en el historial de git. "
        "El catálogo está en data/podcast/episodes.json y el RSS en feed.xml.\n"
    )
    completed = run_command(
        [
            gh_bin(),
            "release",
            "create",
            tag,
            "--latest=false",
            "--title",
            "Podcast — Dr. Armando Alducin F.",
            "--notes",
            notes,
        ]
    )
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout or "No se pudo crear el release").strip())


def upload_file(tag: str, path: Path) -> None:
    completed = run_command([gh_bin(), "release", "upload", tag, str(path), "--clobber"])
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "falló gh release upload").strip()
        raise RuntimeError(detail)


def catalog_episode(episode: dict, entry: dict, cover_rel: str) -> dict:
    duration = entry.get("duration_seconds")
    url = entry.get("audio_url") or None
    if entry.get("status") != "publicado":
        url = None
    return {
        "id": Path(episode["archivo"]).stem,
        "title": episode["titulo"],
        "series": episode["serie"],
        "series_code": episode["codigo_serie"],
        "track": parse_track(episode.get("pista", "1")),
        "year": parse_year((entry.get("upload_date") or "")[:4] or episode.get("anio", "")),
        "date": entry.get("upload_date") or None,
        "duration": round(duration, 1) if isinstance(duration, (int, float)) else None,
        "audio_url": url,
        "cover": cover_rel,
        "source_url": episode.get("source_url") or "",
        "summary": episode.get("resumen") or "",
        "topics": split_list(episode.get("temas", "")),
        "references": split_list(episode.get("referencias", "")),
        "chapters": entry.get("chapters") or [],
        "status": entry.get("status") or "pendiente",
        "artist": episode["artista"],
        "album": episode["album"],
        "file": episode["archivo"],
    }


def build_catalog(episodes: list[dict], state: dict, site: str, cover: Path) -> dict:
    try:
        cover_rel = cover.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        cover_rel = "data/podcast/cover.jpg"
    files = state.get("episodes", {})
    return {
        "updated": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "podcast": {
            "title": PODCAST_TITLE,
            "author": PODCAST_AUTHOR,
            "owner": PODCAST_OWNER,
            "description": PODCAST_DESCRIPTION,
            "language": "es",
            "cover": cover_rel,
            "feed": "feed.xml",
            "site": site.rstrip("/") + "/#podcast",
        },
        "episodes": [
            catalog_episode(episode, files.get(episode["archivo"], empty_entry(episode)), cover_rel)
            for episode in episodes
        ],
    }


def qname(namespace: str, tag: str) -> str:
    return f"{{{namespace}}}{tag}"


def build_feed(catalog: dict, path: Path, site: str, cover_url: str, owner_email: str) -> None:
    ET.register_namespace("itunes", ITUNES)
    ET.register_namespace("atom", ATOM)
    ET.register_namespace("content", CONTENT)
    rss = ET.Element("rss", {"version": "2.0"})
    channel = ET.SubElement(rss, "channel")
    podcast = catalog["podcast"]
    feed_url = site.rstrip("/") + "/feed.xml"
    ET.SubElement(channel, "title").text = podcast["title"]
    ET.SubElement(channel, "link").text = podcast["site"]
    ET.SubElement(channel, "language").text = "es"
    ET.SubElement(channel, "description").text = podcast["description"]
    ET.SubElement(channel, "copyright").text = "Dr. Armando Alducin F. · @BibliaViviente"
    ET.SubElement(channel, "lastBuildDate").text = format_datetime(datetime.now(timezone.utc))
    ET.SubElement(
        channel,
        qname(ATOM, "link"),
        {"href": feed_url, "rel": "self", "type": "application/rss+xml"},
    )
    ET.SubElement(channel, qname(ITUNES, "author")).text = podcast["author"]
    ET.SubElement(channel, qname(ITUNES, "summary")).text = podcast["description"]
    ET.SubElement(channel, qname(ITUNES, "explicit")).text = "false"
    ET.SubElement(channel, qname(ITUNES, "type")).text = "episodic"
    ET.SubElement(channel, qname(ITUNES, "image"), {"href": cover_url})
    owner = ET.SubElement(channel, qname(ITUNES, "owner"))
    ET.SubElement(owner, qname(ITUNES, "name")).text = podcast["owner"]
    if owner_email:
        ET.SubElement(owner, qname(ITUNES, "email")).text = owner_email
    category = ET.SubElement(channel, qname(ITUNES, "category"), {"text": "Religion & Spirituality"})
    ET.SubElement(category, qname(ITUNES, "category"), {"text": "Christianity"})
    image = ET.SubElement(channel, "image")
    ET.SubElement(image, "url").text = cover_url
    ET.SubElement(image, "title").text = podcast["title"]
    ET.SubElement(image, "link").text = podcast["site"]

    lengths = catalog.get("_lengths") or {}
    published = []
    for item in catalog["episodes"]:
        length = int(lengths.get(item["file"]) or 0)
        if item.get("audio_url") and item.get("duration") and length > 0:
            published.append((item, length))
    published.sort(key=lambda pair: (pair[0].get("date") or str(pair[0].get("year") or 0), pair[0].get("track") or 0), reverse=True)
    for item, length in published:
        node = ET.SubElement(channel, "item")
        ET.SubElement(node, "title").text = item["title"]
        ET.SubElement(node, qname(ITUNES, "title")).text = item["title"]
        ET.SubElement(node, qname(ITUNES, "episode")).text = str(item["track"])
        ET.SubElement(node, qname(ITUNES, "episodeType")).text = "full"
        description = item["summary"] or f"{item['title']}. {item['series']}."
        if item.get("chapters"):
            lines = [description, ""]
            for chapter in item["chapters"]:
                lines.append(f"{hms(chapter.get('start'))} {chapter.get('title') or ''}".strip())
            description = "\n".join(lines)
        ET.SubElement(node, "description").text = description
        ET.SubElement(node, qname(ITUNES, "summary")).text = description
        ET.SubElement(node, qname(ITUNES, "author")).text = item["artist"]
        ET.SubElement(node, qname(ITUNES, "image"), {"href": cover_url})
        ET.SubElement(
            node,
            "enclosure",
            {"url": item["audio_url"], "length": str(length), "type": "audio/mpeg"},
        )
        ET.SubElement(node, "guid", {"isPermaLink": "false"}).text = item["file"]
        if item.get("date"):
            when = datetime.strptime(item["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        else:
            when = datetime(int(item.get("year") or datetime.now(timezone.utc).year), 1, 1, tzinfo=timezone.utc)
        ET.SubElement(node, "pubDate").text = format_datetime(when)
        ET.SubElement(node, qname(ITUNES, "duration")).text = hms(item.get("duration"))
        ET.SubElement(node, "link").text = item.get("source_url") or podcast["site"]

    path.parent.mkdir(parents=True, exist_ok=True)
    tree = ET.ElementTree(rss)
    ET.indent(tree, space="  ")
    tree.write(path, encoding="UTF-8", xml_declaration=True)


def attach_lengths(catalog: dict, state: dict) -> None:
    lengths = {}
    files = state.get("episodes", {})
    for item in catalog["episodes"]:
        entry = files.get(item["file"], {})
        if item.get("audio_url") and entry.get("bytes"):
            lengths[item["file"]] = int(entry["bytes"])
    catalog["_lengths"] = lengths


def make_cover(path: Path) -> None:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as exc:
        raise SystemExit(
            "Para regenerar la carátula instala Pillow:\n  pip install pillow"
        ) from exc

    size = 1400
    image = Image.new("RGB", (size, size), "#0b1020")
    draw = ImageDraw.Draw(image)
    top = (12, 16, 36)
    mid = (67, 56, 180)
    bottom = (11, 15, 32)
    for y in range(size):
        t = y / (size - 1)
        if t < 0.58:
            mix = t / 0.58
            color = tuple(int(a + (b - a) * mix) for a, b in zip(top, mid))
        else:
            mix = (t - 0.58) / 0.42
            color = tuple(int(a + (b - a) * mix) for a, b in zip(mid, bottom))
        draw.line([(0, y), (size, y)], fill=color)
    draw.ellipse([180, 80, 1220, 980], outline=(196, 181, 253), width=3)
    draw.rectangle([160, 1040, 1240, 1043], fill=(232, 213, 163))

    def font(bold: bool, px: int):
        candidates = [
            "/usr/share/fonts/truetype/macos/Inter-Bold.ttf" if bold else "/usr/share/fonts/truetype/macos/Inter-Medium.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        for candidate in candidates:
            if Path(candidate).exists():
                return ImageFont.truetype(candidate, px)
        return ImageFont.load_default()

    def center(text: str, y: int, face, fill) -> None:
        box = draw.textbbox((0, 0), text, font=face)
        x = (size - (box[2] - box[0])) / 2
        draw.text((x, y), text, font=face, fill=fill)

    center("PODCAST", 430, font(True, 42), (196, 181, 253))
    center("@BibliaViviente", 520, font(True, 78), (248, 250, 252))
    center("Dr. AAF", 640, font(True, 140), (255, 255, 255))
    center("Dr. Armando Alducin F.", 1100, font(False, 42), (226, 232, 240))
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="JPEG", quality=88, optimize=True)


def write_outputs(episodes, state, site, cover, json_out, feed_out, owner_email, audio_base, release_tag) -> dict:
    state["version"] = 1
    state["release_tag"] = release_tag
    state["audio_base_url"] = audio_base
    reconcile_entries(episodes, state)
    catalog = build_catalog(episodes, state, site, cover)
    attach_lengths(catalog, state)
    public_catalog = {key: value for key, value in catalog.items() if key != "_lengths"}
    save_json(json_out, public_catalog)
    build_feed(catalog, feed_out, site, public_site_url(site, cover), owner_email)
    return public_catalog


def process_episode(episode, entry, args, work_dir: Path, cover: Path) -> dict:
    filename = episode["archivo"]
    target = work_dir / filename
    result = {"archivo": filename, "status": entry.get("status") or "pendiente", "detail": ""}

    if (
        not args.force
        and entry.get("status") == "publicado"
        and entry.get("audio_url")
        and not args.substitute_audio
    ):
        result["status"] = "publicado"
        result["detail"] = "Ya está en el release. Usa --force para rehacerlo."
        return result

    if args.metadata_only:
        result["detail"] = "Solo metadatos."
        return result

    raw_dir = work_dir / "raw" / Path(filename).stem
    try:
        if args.substitute_audio:
            source = Path(args.substitute_audio)
            if not source.is_file():
                raise DownloadError(f"No existe --substitute-audio {source}")
            convert_to_mp3(source, target)
            result["detail"] = "Audio de prueba sustituido (no es el episodio real)."
        elif target.exists() and not args.force:
            result["detail"] = "Se reutilizó el MP3 local y se reescribieron las etiquetas."
        elif not episode.get("source_url"):
            entry.update(empty_entry(episode))
            result["status"] = "sin_fuente"
            result["detail"] = "Sin source_url: no hay audio que descargar."
            return result
        else:
            if args.force and target.exists():
                target.unlink()
            source = download_source(episode["source_url"], raw_dir, args.cookies)
            convert_to_mp3(source, target)
            result["detail"] = "Audio descargado y convertido a MP3."

        apply_upload_date(episode, entry, fetch_upload_date(episode.get("source_url", ""), args.cookies))
        write_id3(target, episode, episode_cover(episode, cover))
        duration = probe_duration(target)
        entry["sha256"] = sha256_file(target)
        entry["bytes"] = target.stat().st_size
        entry["duration_seconds"] = round(duration, 1)
        entry["source_url"] = episode.get("source_url", "")
        entry["processed_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        entry["error"] = ""
        entry["status"] = "etiquetado"
        if episode.get("_chapters"):
            entry["chapters"] = episode["_chapters"]
        result["status"] = "etiquetado"
    except DownloadError as exc:
        entry["status"] = "error_descarga" if episode.get("source_url") and not args.substitute_audio else entry.get("status", "pendiente")
        if not episode.get("source_url"):
            entry["status"] = "sin_fuente"
        entry["error"] = str(exc)
        result["status"] = entry["status"]
        result["detail"] = str(exc)
        print(f"[error] {filename}: {exc}", file=sys.stderr)
        return result

    if args.upload:
        try:
            upload_file(args.release_tag, target)
        except RuntimeError as exc:
            entry["error"] = str(exc)
            result["status"] = "etiquetado"
            result["detail"] = f"Etiquetado, pero no se pudo subir: {exc}"
            result["upload_error"] = True
            print(f"[error] {filename}: {exc}", file=sys.stderr)
            return result
        entry["status"] = "publicado"
        entry["audio_url"] = audio_url(args.audio_base_url, filename)
        entry["error"] = ""
        result["status"] = "publicado"
        result["detail"] = "Subido al release " + args.release_tag
    return result


def write_step_summary(results: list[dict]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    lines = ["## Podcast", "", "| Archivo | Estado | Detalle |", "| --- | --- | --- |"]
    for item in results:
        detail = (item.get("detail") or "").replace("|", "/")
        lines.append(f"| `{item['archivo']}` | {item['status']} | {detail} |")
    with open(path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def run(args: argparse.Namespace) -> int:
    slug = detect_repo_slug()
    detected_site, detected_audio = repo_urls(slug)
    if not args.site_url:
        args.site_url = detected_site
    if not args.audio_base_url:
        args.audio_base_url = detected_audio
    if not args.release_tag:
        args.release_tag = RELEASE_TAG

    manifest_path = resolve_path(args.manifest)
    state_path = resolve_path(args.state)
    json_out = resolve_path(args.json_out)
    feed_out = resolve_path(args.feed_out)
    cover = resolve_path(args.cover)
    work_dir = resolve_path(args.work_dir)

    if args.make_cover:
        make_cover(cover)
        print(f"[ok] Carátula escrita en {cover}")
        return 0

    if args.upload and args.substitute_audio:
        print(
            "No se puede --upload junto con --substitute-audio: ese archivo no es el episodio real.",
            file=sys.stderr,
        )
        return 1
    if args.substitute_audio and not args.only:
        print(
            "Usa --only junto con --substitute-audio para no etiquetar todos los episodios con el mismo audio de prueba.",
            file=sys.stderr,
        )
        return 1
    if args.substitute_audio and not Path(args.substitute_audio).is_file():
        print(f"No existe el audio de prueba: {args.substitute_audio}", file=sys.stderr)
        return 1
    if args.transcribe and not args.metadata_only and not args.dry_run:
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            print(
                "La transcripción necesita faster-whisper y no está instalado.\n"
                "  pip install faster-whisper\n"
                "Es opcional porque en CI es lento. Sin --transcribe la herramienta no lo usa.",
                file=sys.stderr,
            )
            return 1

    sheet_url = (args.sheet_url or "").strip()
    if sheet_url and not args.dry_run:
        try:
            incoming = parse_manifest_text(download_sheet(sheet_url))
        except (DownloadError, ValueError) as exc:
            print(f"[aviso] No usé la hoja de cálculo ({exc}). Sigue el CSV del repositorio.", file=sys.stderr)
        else:
            existing = read_manifest(manifest_path) if manifest_path.exists() else []
            episodes = merge_sheet(existing, incoming)
            write_manifest(manifest_path, episodes)
            print(f"[ok] Manifiesto actualizado desde la hoja ({len(episodes)} episodios).")

    if not manifest_path.exists():
        print(f"No existe el manifiesto {manifest_path}", file=sys.stderr)
        return 1
    try:
        episodes = read_manifest(manifest_path)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.only:
        wanted = {safe_filename(part.strip()) for part in args.only.split(",") if part.strip()}
        episodes_to_process = [episode for episode in episodes if episode["archivo"] in wanted]
        if not episodes_to_process:
            print(f"Ningún episodio coincide con --only {args.only}", file=sys.stderr)
            return 1
    else:
        episodes_to_process = list(episodes)

    warnings = []
    for episode in episodes:
        warnings.extend(filename_warnings(episode))
    for warning in warnings:
        print(f"[aviso] {warning}")

    state = load_state(state_path)
    reconcile_entries(episodes, state)

    if args.dry_run:
        for episode in episodes_to_process:
            entry = state["episodes"][episode["archivo"]]
            print(f"[plan] {episode['archivo']} · {entry['status']} · {episode['source_url'] or 'sin fuente'}")
        print("Simulación: no se escribió nada.")
        return 0

    if args.upload:
        try:
            ensure_release(args.release_tag)
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            return 1

    manifest_changed = False
    results = []
    upload_errors = False
    for episode in episodes_to_process:
        entry = state["episodes"][episode["archivo"]]
        if args.transcribe and not args.metadata_only:
            # La transcripción ocurre después de tener MP3; se aplica en la segunda pasada.
            pass
        result = process_episode(episode, entry, args, work_dir, cover)
        target = work_dir / episode["archivo"]
        if args.transcribe and target.exists() and result["status"] in {"etiquetado", "publicado"}:
            try:
                segments = transcribe_file(target, args.whisper_model)
            except SystemExit:
                raise
            except Exception as exc:
                print(f"[aviso] No se transcribió {episode['archivo']}: {exc}", file=sys.stderr)
            else:
                transcript = work_dir / "transcripts" / (Path(episode["archivo"]).stem + ".txt")
                if apply_suggestions(episode, segments, transcript):
                    manifest_changed = True
                if episode.get("_chapters"):
                    entry["chapters"] = episode["_chapters"]
                print(f"[ok] Sugerencias de transcripción para {episode['archivo']} (revisar el CSV).")
        if entry.get("upload_date") and episode.get("fecha"):
            manifest_changed = True  # año y «Disco no» vienen de la fecha de YouTube
        results.append(result)
        if result.get("upload_error"):
            upload_errors = True
        print(f"[{result['status']}] {episode['archivo']}: {result['detail']}")

    if manifest_changed:
        # Reescribir el manifiesto completo, no solo el subconjunto de --only.
        by_file = {episode["archivo"]: episode for episode in episodes}
        write_manifest(manifest_path, [by_file[episode["archivo"]] for episode in episodes])

    catalog = write_outputs(
        episodes,
        state,
        args.site_url,
        cover,
        json_out,
        feed_out,
        args.owner_email,
        args.audio_base_url,
        args.release_tag,
    )
    save_json(state_path, state)
    report = {
        "ran_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "results": results,
        "warnings": warnings,
        "episodes_in_catalog": len(catalog["episodes"]),
        "episodes_in_feed": sum(1 for item in catalog["episodes"] if item.get("audio_url")),
    }
    report_path = work_dir / "report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    save_json(report_path, report)
    write_step_summary(results)
    print(f"[ok] Catálogo: {json_out}")
    print(f"[ok] RSS: {feed_out}")
    if args.metadata_only:
        print("Solo se actualizaron los metadatos. No se descargó audio.")
    else:
        print(
            "Los MP3 quedan en "
            f"{work_dir} y, con --upload, en el release «{args.release_tag}». No se commitean."
        )
    return 1 if upload_errors else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Etiqueta el podcast de Dr. Armando Alducin F. y publica metadatos (sin MP3 en git).",
        epilog=(
            "Respaldo local si YouTube bloquea GitHub:\n"
            "  python3 tools/podcast/tag_podcast.py --upload\n"
            "Prueba con un audio corto, sin subir:\n"
            "  python3 tools/podcast/tag_podcast.py --substitute-audio ./prueba.mp3 "
            "--only DAAF_Armando_Alducin_F_DYEM_01.mp3"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--manifest", default="data/podcast/episodes.csv")
    parser.add_argument("--state", default="data/podcast/state.json")
    parser.add_argument("--json-out", default="data/podcast/episodes.json")
    parser.add_argument("--feed-out", default="feed.xml")
    parser.add_argument("--cover", default="data/podcast/cover.jpg")
    parser.add_argument("--work-dir", default="dist/podcast")
    parser.add_argument("--sheet-url", default=os.environ.get("PODCAST_SHEET_CSV_URL", ""))
    parser.add_argument("--site-url", default=os.environ.get("PODCAST_SITE_URL", ""))
    parser.add_argument("--audio-base-url", default=os.environ.get("PODCAST_AUDIO_BASE_URL", ""))
    parser.add_argument("--release-tag", default=os.environ.get("PODCAST_RELEASE_TAG", RELEASE_TAG))
    parser.add_argument("--owner-email", default=os.environ.get("PODCAST_OWNER_EMAIL", ""))
    parser.add_argument("--cookies", default=os.environ.get("PODCAST_COOKIES", ""))
    parser.add_argument("--transcribe", action="store_true", help="Sugerir título, resumen, temas y citas con faster-whisper")
    parser.add_argument("--whisper-model", default=os.environ.get("PODCAST_WHISPER_MODEL", "small"))
    parser.add_argument("--upload", action="store_true", help="Sube los MP3 al GitHub Release (no al git)")
    parser.add_argument("--force", action="store_true", help="Vuelve a procesar episodios ya publicados")
    parser.add_argument("--only", default="", help="Solo estos archivos, separados por coma")
    parser.add_argument("--substitute-audio", default="", help="Usa este audio local en vez de descargar. No se puede combinar con --upload")
    parser.add_argument("--metadata-only", action="store_true", help="Regenera JSON y RSS sin descargar")
    parser.add_argument("--make-cover", action="store_true", help="Regenera la carátula (necesita Pillow)")
    parser.add_argument("--dry-run", action="store_true", help="Muestra el plan y no escribe archivos")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
