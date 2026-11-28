"""Unit tests for the pure parts of generate.py. Stdlib only: no model, no audio libraries.

Run from the repo root: python3 -m unittest discover tools/narration
"""

import math
import unittest

import generate as g

TOUR = {
    "steps": [
        {"id": "step-1", "lines": [{"id": "s1-l1", "text": "Chào bạn."}, {"id": "s1-l2", "text": "Gối gập."}]},
        {"id": "step-2", "lines": [{"id": "s2-l1", "text": "Dải chậu chày."}]},
    ]
}
VOICES = {"ngoc-huyen": g.Voice(preset="Ngọc Huyền", label="Ngọc Huyền")}


def fresh_manifest(lines):
    manifest = g.empty_manifest()
    for line_id, text in lines:
        g.record(manifest, "ngoc-huyen", VOICES["ngoc-huyen"], line_id, text)
    return manifest


class TextHash(unittest.TestCase):
    def test_sha256_of_utf8_text_as_written(self):
        self.assertEqual(
            g.text_sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        )

    def test_no_unicode_normalisation(self):
        # "ồ" composed vs decomposed: the check in #54 must hash exactly what tour.json holds.
        self.assertNotEqual(g.text_sha256("ồ"), g.text_sha256("ồ"))


class TourLines(unittest.TestCase):
    def test_lines_in_tour_order(self):
        self.assertEqual(
            [i for i, _ in g.tour_lines(TOUR)], ["s1-l1", "s1-l2", "s2-l1"]
        )

    def test_duplicate_line_id_is_an_error(self):
        tour = {"steps": [{"lines": [{"id": "a", "text": "x"}, {"id": "a", "text": "y"}]}]}
        with self.assertRaises(ValueError):
            g.tour_lines(tour)


class Plan(unittest.TestCase):
    lines = g.tour_lines(TOUR)
    all_files = {("ngoc-huyen", i) for i, _ in lines}

    def test_everything_is_missing_at_first(self):
        todo, orphans = g.plan(self.lines, g.empty_manifest(), VOICES, set(), force=False)
        self.assertEqual(todo, [("ngoc-huyen", "s1-l1"), ("ngoc-huyen", "s1-l2"), ("ngoc-huyen", "s2-l1")])
        self.assertEqual(orphans, [])

    def test_nothing_to_do_when_up_to_date(self):
        todo, orphans = g.plan(self.lines, fresh_manifest(self.lines), VOICES, self.all_files, force=False)
        self.assertEqual((todo, orphans), ([], []))

    def test_changed_text_is_stale(self):
        manifest = fresh_manifest(self.lines)
        edited = [(i, t + " Thêm.") if i == "s1-l2" else (i, t) for i, t in self.lines]
        todo, _ = g.plan(edited, manifest, VOICES, self.all_files, force=False)
        self.assertEqual(todo, [("ngoc-huyen", "s1-l2")])

    def test_changed_settings_are_stale(self):
        manifest = fresh_manifest(self.lines)
        manifest["voices"]["ngoc-huyen"]["lines"]["s2-l1"]["settings"]["temperature"] = 0.5
        todo, _ = g.plan(self.lines, manifest, VOICES, self.all_files, force=False)
        self.assertEqual(todo, [("ngoc-huyen", "s2-l1")])

    def test_missing_file_is_stale(self):
        files = self.all_files - {("ngoc-huyen", "s1-l1")}
        todo, _ = g.plan(self.lines, fresh_manifest(self.lines), VOICES, files, force=False)
        self.assertEqual(todo, [("ngoc-huyen", "s1-l1")])

    def test_force_regenerates_everything(self):
        todo, _ = g.plan(self.lines, fresh_manifest(self.lines), VOICES, self.all_files, force=True)
        self.assertEqual(len(todo), 3)

    def test_line_gone_from_the_tour_is_an_orphan(self):
        manifest = fresh_manifest(self.lines)
        files = self.all_files | {("ngoc-huyen", "s9-l9")}
        todo, orphans = g.plan(self.lines[:2], manifest, VOICES, files, force=False)
        self.assertEqual(todo, [])
        self.assertEqual(orphans, [("ngoc-huyen", "s2-l1"), ("ngoc-huyen", "s9-l9")])


class Manifest(unittest.TestCase):
    def test_record_stores_hash_and_settings_per_line(self):
        manifest = fresh_manifest([("s1-l1", "Chào bạn.")])
        voice = manifest["voices"]["ngoc-huyen"]
        self.assertEqual(voice["label"], "Ngọc Huyền")
        entry = voice["lines"]["s1-l1"]
        self.assertEqual(entry["textSha256"], g.text_sha256("Chào bạn."))
        self.assertEqual(entry["settings"], g.settings(VOICES["ngoc-huyen"]))

    def test_settings_name_the_pinned_versions(self):
        s = g.settings(VOICES["ngoc-huyen"])
        self.assertEqual(s["sdk"], "vieneu==" + g.VIENEU_VERSION)
        self.assertEqual(s["model"], g.MODEL_REPO + "@" + g.MODEL_REVISION)
        self.assertEqual(s["codec"], g.CODEC_REPO + "@" + g.CODEC_REVISION)
        self.assertEqual(s["preset"], "Ngọc Huyền")
        self.assertEqual(s["precision"], "fp32")

    def test_forget_drops_the_line(self):
        manifest = fresh_manifest([("s1-l1", "Chào bạn.")])
        g.forget(manifest, "ngoc-huyen", "s1-l1")
        self.assertEqual(manifest["voices"]["ngoc-huyen"]["lines"], {})


class Loudness(unittest.TestCase):
    def test_gain_brings_speech_to_the_target(self):
        gain = g.loudness_gain(measured_lufs=-26.0, peak=0.1, target_lufs=-16.0, ceiling_dbfs=-1.0)
        self.assertAlmostEqual(20 * math.log10(gain), 10.0)

    def test_gain_is_capped_so_the_peak_stays_under_the_ceiling(self):
        gain = g.loudness_gain(measured_lufs=-30.0, peak=0.5, target_lufs=-16.0, ceiling_dbfs=-1.0)
        self.assertAlmostEqual(0.5 * gain, 10 ** (-1.0 / 20))

    def test_silence_is_left_alone(self):
        self.assertEqual(g.loudness_gain(-math.inf, 0.0, -16.0, -1.0), 1.0)


if __name__ == "__main__":
    unittest.main()
