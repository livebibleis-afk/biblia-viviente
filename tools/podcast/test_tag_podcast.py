#!/usr/bin/env python3
"""Pruebas del etiquetador. No descargan YouTube ni suben archivos."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tag_podcast as tp

ROOT = tp.ROOT
ITUNES = tp.ITUNES


def tone(path: Path, seconds: float = 1.2) -> None:
    binary = shutil.which("ffmpeg")
    if not binary:
        raise unittest.SkipTest("ffmpeg no está instalado")
    subprocess.check_call(
        [
            binary,
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=440:duration={seconds}",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "64k",
            str(path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


class ManifestTests(unittest.TestCase):
    def test_seed_has_only_the_two_sheet_episodes(self):
        episodes = tp.read_manifest(ROOT / "data/podcast/episodes.csv")
        self.assertEqual(len(episodes), 2)
        first, second = episodes
        self.assertEqual(first["archivo"], "DAAF_Armando_Alducin_F_RESA_01.mp3")
        self.assertEqual(first["titulo"], "Reportaje Especial Sobre Afganistan (Parte 01)")
        self.assertEqual(first["artista"], "Dr. Armando Alducin F.")
        self.assertEqual(first["anio"], "2021")
        self.assertEqual(first["pista"], "1")
        self.assertEqual(first["disco"], "888802")
        self.assertEqual(first["genero"], "@BibliaViviente")
        self.assertEqual(first["compositor"], "@BibliaViviente")
        self.assertEqual(first["artista_album"], "@BibliaViviente")
        self.assertEqual(first["codigo_serie"], "RESA")
        self.assertEqual(first["source_url"], "")
        self.assertIn("Reportaje Especial Sobre Afganistan", first["album"])
        self.assertEqual(second["archivo"], "DAAF_Armando_Alducin_F_DYEM_01.mp3")
        self.assertEqual(second["titulo"], "Introducción | Dios y la Existencia del Mal 01")
        self.assertEqual(second["anio"], "2015")
        self.assertEqual(second["disco"], "20151407")
        self.assertEqual(second["source_url"], "https://youtu.be/3McxO3SnKHI")
        self.assertIn("Jeshua", second["comentarios"])
        self.assertIn("🇺🇲", second["comentarios"])

    def test_aliases_and_blank_rows(self):
        text = (
            "Archivo,Título,Artista,Álbum,Año,Pista,Género,Comentarios,Disco no,Compositor,"
            "Artista del álbum,Carátula,URL\n"
            "-,-,-,-,-,-,-,-,-,-,-,-,-\n"
            ",Un estudio, , ,2020,01;,@BibliaViviente,Nota,123456,@BibliaViviente,@BibliaViviente,"
            "@BibliaViviente Dr. AAF,https://youtu.be/abcdefghijk?si=tracking\n"
        )
        episodes = tp.parse_manifest_text(text)
        self.assertEqual(len(episodes), 1)
        episode = episodes[0]
        self.assertEqual(episode["titulo"], "Un estudio")
        self.assertEqual(episode["pista"], "1")
        self.assertEqual(episode["disco"], "123456")
        self.assertEqual(episode["source_url"], "https://youtu.be/abcdefghijk")
        self.assertTrue(episode["archivo"].endswith("_UNES_01.mp3"))
        self.assertTrue(episode["archivo"].startswith(tp.SPEAKER_PREFIX))

    def test_sheet_keeps_local_suggestions(self):
        old = [{"archivo": "A.mp3", "titulo": "Viejo", "resumen": "Notas locales", "temas": "", "referencias": "", "titulo_sugerido": ""}]
        new = [{"archivo": "A.mp3", "titulo": "Nuevo", "resumen": "", "temas": "Fe", "referencias": "", "titulo_sugerido": ""}]
        merged = tp.merge_sheet(old, new)
        self.assertEqual(merged[0]["titulo"], "Nuevo")
        self.assertEqual(merged[0]["resumen"], "Notas locales")
        self.assertEqual(merged[0]["temas"], "Fe")

    def test_rejects_csv_without_title(self):
        with self.assertRaises(ValueError):
            tp.parse_manifest_text("foo,bar\n1,2\n")


class SuggestionTests(unittest.TestCase):
    def test_bible_references_topics_and_chapters(self):
        text = (
            "Hoy leemos Juan 3:16 y también Romanos 8. "
            "Génesis 1 muestra la creación. La creación y la esperanza de la creación "
            "sostienen la esperanza del evangelio y la esperanza de la gracia."
        )
        refs = tp.extract_references(text)
        self.assertIn("Juan 3:16", refs)
        self.assertIn("Romanos 8", refs)
        self.assertIn("Génesis 1", refs)
        topics = tp.extract_topics(text)
        self.assertIn("Creación", topics)
        self.assertIn("Esperanza", topics)
        summary = tp.summarize(text)
        self.assertTrue(summary.startswith("Hoy leemos"))
        chapters = tp.chapters_from_segments(
            [
                {"start": 0, "text": "Introducción al tema de la gracia."},
                {"start": 320, "text": "Seguimos con la esperanza del evangelio."},
            ]
        )
        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[1]["start"], 320)

    def test_transcribe_is_optional(self):
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            with self.assertRaises(SystemExit):
                tp.transcribe_file(Path("no-existe.mp3"), "tiny")
        else:
            self.skipTest("faster-whisper está instalado; no hace falta comprobar la ausencia")


class TagAndFeedTests(unittest.TestCase):
    def test_id3_roundtrip_and_catalog(self):
        try:
            from mutagen.id3 import ID3
        except ImportError:
            self.skipTest("mutagen no está instalado")
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source = folder / "tone.mp3"
            tone(source)
            cover = folder / "cover.jpg"
            if (ROOT / "data/podcast/cover.jpg").exists():
                cover.write_bytes((ROOT / "data/podcast/cover.jpg").read_bytes())
            else:
                cover.write_bytes(source.read_bytes()[:64])
            manifest = folder / "episodes.csv"
            manifest.write_text(
                (ROOT / "data/podcast/episodes.csv").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            code = tp.main(
                [
                    "--manifest",
                    str(manifest),
                    "--state",
                    str(folder / "state.json"),
                    "--json-out",
                    str(folder / "episodes.json"),
                    "--feed-out",
                    str(folder / "feed.xml"),
                    "--cover",
                    str(ROOT / "data/podcast/cover.jpg") if (ROOT / "data/podcast/cover.jpg").exists() else str(cover),
                    "--work-dir",
                    str(folder / "work"),
                    "--substitute-audio",
                    str(source),
                    "--only",
                    "DAAF_Armando_Alducin_F_DYEM_01.mp3",
                    "--site-url",
                    "https://livebibleis-afk.github.io/biblia-viviente",
                    "--audio-base-url",
                    "https://github.com/livebibleis-afk/biblia-viviente/releases/download/podcast",
                ]
            )
            self.assertEqual(code, 0)
            tagged = folder / "work" / "DAAF_Armando_Alducin_F_DYEM_01.mp3"
            self.assertTrue(tagged.exists())
            tags = ID3(tagged)
            self.assertEqual(tags.getall("TIT2")[0].text[0], "Introducción | Dios y la Existencia del Mal 01")
            self.assertEqual(tags.getall("TPE1")[0].text[0], "Dr. Armando Alducin F.")
            self.assertIn("Dios y la Existencia del Mal", tags.getall("TALB")[0].text[0])
            self.assertEqual(str(tags.getall("TDRC")[0].text[0]), "2015")
            self.assertEqual(str(tags.getall("TRCK")[0].text[0]), "1")
            self.assertEqual(tags.getall("TCON")[0].text[0], "@BibliaViviente")
            self.assertIn("Jeshua", tags.getall("COMM")[0].text[0])
            self.assertEqual(str(tags.getall("TPOS")[0].text[0]), "20151407")
            self.assertEqual(tags.getall("TCOM")[0].text[0], "@BibliaViviente")
            self.assertEqual(tags.getall("TPE2")[0].text[0], "@BibliaViviente")
            self.assertEqual(tags.getall("WXXX")[0].url, "https://youtu.be/3McxO3SnKHI")
            self.assertTrue(tags.getall("APIC"), "la carátula debe ir embebida")
            catalog = json.loads((folder / "episodes.json").read_text(encoding="utf-8"))
            self.assertEqual(len(catalog["episodes"]), 2)
            published = [item for item in catalog["episodes"] if item["audio_url"]]
            self.assertEqual(published, [])
            by_file = {item["file"]: item for item in catalog["episodes"]}
            self.assertEqual(by_file["DAAF_Armando_Alducin_F_RESA_01.mp3"]["status"], "sin_fuente")
            self.assertEqual(by_file["DAAF_Armando_Alducin_F_DYEM_01.mp3"]["status"], "etiquetado")
            self.assertGreater(by_file["DAAF_Armando_Alducin_F_DYEM_01.mp3"]["duration"], 0)
            feed_text = (folder / "feed.xml").read_text(encoding="utf-8")
            self.assertIn("xmlns:itunes=\"http://www.itunes.com/dtds/podcast-1.0.dtd\"", feed_text)
            self.assertIn("<itunes:author>", feed_text)
            root = ET.parse(folder / "feed.xml").getroot()
            self.assertEqual(root.tag, "rss")
            channel = root.find("channel")
            author = channel.find(f"{{{ITUNES}}}author")
            self.assertIsNotNone(author)
            self.assertEqual(author.text, "Dr. Armando Alducin F.")
            self.assertEqual(channel.findall("item"), [])
            self.assertIsNotNone(channel.find(f"{{{ITUNES}}}image"))

    def test_download_failure_does_not_abort_the_catalog(self):
        def blocked(url, dest_dir, cookies=""):
            raise tp.DownloadError(tp.friendly_download_error("HTTP Error 403: Forbidden"))

        original = tp.download_source
        tp.download_source = blocked
        try:
            with tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp)
                manifest = folder / "episodes.csv"
                manifest.write_text(
                    "archivo,titulo,artista,album,anio,pista,genero,comentarios,disco,compositor,"
                    "artista_album,caratula,serie,codigo_serie,source_url\n"
                    "DAAF_Armando_Alducin_F_DYEM_01.mp3,Introducción,Dr. Armando Alducin F.,"
                    "Album,2015,1,@BibliaViviente,,20151407,@BibliaViviente,@BibliaViviente,"
                    "@BibliaViviente Dr. AAF,Dios y la Existencia del Mal,DYEM,https://youtu.be/3McxO3SnKHI\n",
                    encoding="utf-8",
                )
                code = tp.main(
                    [
                        "--manifest",
                        str(manifest),
                        "--state",
                        str(folder / "state.json"),
                        "--json-out",
                        str(folder / "episodes.json"),
                        "--feed-out",
                        str(folder / "feed.xml"),
                        "--work-dir",
                        str(folder / "work"),
                        "--metadata-only",
                    ]
                )
                self.assertEqual(code, 0)
                code = tp.main(
                    [
                        "--manifest",
                        str(manifest),
                        "--state",
                        str(folder / "state.json"),
                        "--json-out",
                        str(folder / "episodes.json"),
                        "--feed-out",
                        str(folder / "feed.xml"),
                        "--work-dir",
                        str(folder / "work"),
                    ]
                )
                self.assertEqual(code, 0)
                state = json.loads((folder / "state.json").read_text(encoding="utf-8"))
                entry = state["episodes"]["DAAF_Armando_Alducin_F_DYEM_01.mp3"]
                self.assertEqual(entry["status"], "error_descarga")
                self.assertIn("tag_podcast.py --upload", entry["error"])
                catalog = json.loads((folder / "episodes.json").read_text(encoding="utf-8"))
                self.assertIsNone(catalog["episodes"][0]["audio_url"])
        finally:
            tp.download_source = original

    def test_published_episode_enters_the_feed(self):
        episodes = tp.read_manifest(ROOT / "data/podcast/episodes.csv")
        state = {"version": 1, "episodes": {}}
        tp.reconcile_entries(episodes, state)
        filename = "DAAF_Armando_Alducin_F_DYEM_01.mp3"
        state["episodes"][filename].update(
            {
                "status": "publicado",
                "audio_url": "https://github.com/livebibleis-afk/biblia-viviente/releases/download/podcast/" + filename,
                "duration_seconds": 95,
                "bytes": 123456,
                "error": "",
            }
        )
        catalog = tp.build_catalog(
            episodes,
            state,
            "https://livebibleis-afk.github.io/biblia-viviente",
            ROOT / "data/podcast/cover.jpg",
        )
        tp.attach_lengths(catalog, state)
        with tempfile.TemporaryDirectory() as tmp:
            feed = Path(tmp) / "feed.xml"
            tp.build_feed(
                catalog,
                feed,
                "https://livebibleis-afk.github.io/biblia-viviente",
                "https://livebibleis-afk.github.io/biblia-viviente/data/podcast/cover.jpg",
                "",
            )
            root = ET.parse(feed).getroot()
            channel = root.find("channel")
            items = channel.findall("item")
            self.assertEqual(len(items), 1)
            enclosure = items[0].find("enclosure")
            self.assertEqual(enclosure.attrib["length"], "123456")
            self.assertEqual(enclosure.attrib["type"], "audio/mpeg")
            self.assertTrue(enclosure.attrib["url"].endswith(filename))
            self.assertEqual(items[0].find(f"{{{ITUNES}}}duration").text, "00:01:35")
            explicit = channel.find(f"{{{ITUNES}}}explicit")
            self.assertEqual(explicit.text, "false")


if __name__ == "__main__":
    unittest.main()
