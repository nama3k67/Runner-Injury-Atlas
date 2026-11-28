"""Generate tour narration with VieNeu-TTS v3 Turbo (ADR 0014).

Reads content/injuries/<injury>/tour.json and writes one Ogg Opus file per line per voice to
apps/web/public/narration/<injury>/<voice>/<line id>.ogg, plus manifest.json next to the voice
folders. Only missing or stale lines are generated unless --all is given.

Run by hand; see README.md. The pure functions at the top need only the standard library,
so the tests run without the model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

# Pinned versions (ADR 0014, decision 2). Changing one means regenerating and hearing every file.
VIENEU_VERSION = "3.8.5"
MODEL_REPO = "pnnbao-ump/VieNeu-TTS-v3-Turbo"
MODEL_REVISION = "61b85e3d937fbbacb387714180e8182823512523"
# The fp32 ONNX path in vieneu 3.8.5 loads this repo (hardcoded as _CODEC_REPO in the SDK).
CODEC_REPO = "OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX"
CODEC_REVISION = "ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae"
ONNX_SUBFOLDER = "onnx_update"  # the fp32 graphs; "onnx_int8" holds the int8 ones
SAMPLE_RATE = 48_000
TEMPERATURE = 0.8  # the SDK default, recorded so a change shows up as stale
# Speech here peaks up to 20 dB above its loudness (measured on the first full run, 108 lines),
# so -21 LUFS is the loudest level every line reaches under the -1 dBFS ceiling.
TARGET_LUFS = -21.0
CEILING_DBFS = -1.0


@dataclass(frozen=True)
class Voice:
    preset: str  # the SDK's preset voice name
    label: str  # Vietnamese label shown in the tour's voice menu (#55)


# Picked by the maintainer on 2026-11-26 (#28). Slug ids follow ADR 0014, decision 4.
VOICES: dict[str, Voice] = {
    "ngoc-huyen": Voice(preset="Ngọc Huyền", label="Ngọc Huyền (nữ, giọng Bắc)"),
    "truc-ly": Voice(preset="Trúc Ly", label="Trúc Ly (nữ, giọng Bắc)"),
    "hai-dang": Voice(preset="Hải Đăng", label="Hải Đăng (nam, giọng Bắc)"),
}

ROOT = Path(__file__).resolve().parents[2]


# --- Pure logic ---------------------------------------------------------------------------


def text_sha256(text: str) -> str:
    """Hash of a line's text exactly as tour.json holds it (UTF-8, no normalisation)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def tour_lines(tour: dict) -> list[tuple[str, str]]:
    """(line id, text) in tour order."""
    lines: list[tuple[str, str]] = []
    seen: set[str] = set()
    for step in tour["steps"]:
        for line in step["lines"]:
            if line["id"] in seen:
                raise ValueError(f"duplicate line id {line['id']!r} in tour.json")
            seen.add(line["id"])
            lines.append((line["id"], line["text"]))
    return lines


def settings(voice: Voice) -> dict:
    """Everything the audio of one line depends on, apart from its text."""
    return {
        "sdk": "vieneu==" + VIENEU_VERSION,
        "model": MODEL_REPO + "@" + MODEL_REVISION,
        "codec": CODEC_REPO + "@" + CODEC_REVISION,
        "precision": "fp32",
        "preset": voice.preset,
        "temperature": TEMPERATURE,
        "loudnessLufs": TARGET_LUFS,
        "format": "ogg-opus",
    }


def empty_manifest() -> dict:
    return {"voices": {}}


def record(manifest: dict, voice_id: str, voice: Voice, line_id: str, text: str) -> None:
    entry = manifest["voices"].setdefault(voice_id, {"lines": {}})
    entry["label"] = voice.label
    entry["lines"][line_id] = {"textSha256": text_sha256(text), "settings": settings(voice)}


def forget(manifest: dict, voice_id: str, line_id: str) -> None:
    manifest["voices"].get(voice_id, {}).get("lines", {}).pop(line_id, None)


def plan(
    lines: list[tuple[str, str]],
    manifest: dict,
    voices: dict[str, Voice],
    files: set[tuple[str, str]],
    force: bool,
) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Which (voice, line) pairs to generate, and which to delete because the line is gone.

    A line is stale when it has no file, no manifest entry, a different text hash or
    different settings. Voices not in `voices` are left alone.
    """
    todo: list[tuple[str, str]] = []
    orphans: set[tuple[str, str]] = set()
    current = {line_id for line_id, _ in lines}
    for voice_id, voice in voices.items():
        recorded = manifest["voices"].get(voice_id, {}).get("lines", {})
        for line_id, text in lines:
            entry = recorded.get(line_id)
            stale = (
                force
                or (voice_id, line_id) not in files
                or entry is None
                or entry.get("textSha256") != text_sha256(text)
                or entry.get("settings") != settings(voice)
            )
            if stale:
                todo.append((voice_id, line_id))
        known = set(recorded) | {line for v, line in files if v == voice_id}
        orphans |= {(voice_id, line_id) for line_id in known - current}
    return todo, sorted(orphans)


def loudness_gain(measured_lufs: float, peak: float, target_lufs: float, ceiling_dbfs: float) -> float:
    """Linear gain to reach the target loudness without the sample peak passing the ceiling."""
    if not math.isfinite(measured_lufs) or peak <= 0:
        return 1.0
    gain = 10 ** ((target_lufs - measured_lufs) / 20)
    # ponytail: sample peak, not true peak; Opus can overshoot a little. Use a true-peak
    # limiter if clipping is ever heard.
    return min(gain, 10 ** (ceiling_dbfs / 20) / peak)


# --- Model and audio (needs requirements.txt) ---------------------------------------------


def load_tts():
    """Load VieNeu-TTS v3 Turbo, fp32 ONNX on CPU, at the pinned revisions."""
    from importlib.metadata import version

    from huggingface_hub import HfApi, snapshot_download

    if version("vieneu") != VIENEU_VERSION:
        sys.exit(f"vieneu {version('vieneu')} is installed; this tool pins {VIENEU_VERSION}.")

    # The SDK has no revision parameter, so the model is fetched at the pinned revision and
    # loaded from that local snapshot.
    model_dir = snapshot_download(
        MODEL_REPO,
        revision=MODEL_REVISION,
        allow_patterns=[f"{ONNX_SUBFOLDER}/*", "voices_v3_turbo.json", "config.json"],
    )
    # The SDK fetches the codec from main (vieneu 3.8.5, onnx_runtime_lite._CODEC_REPO), so refuse if main moved.
    # ponytail: checked just before the SDK downloads it; a push in between would slip through.
    codec_head = HfApi().model_info(CODEC_REPO).sha
    if codec_head != CODEC_REVISION:
        sys.exit(
            f"{CODEC_REPO} is at {codec_head}, not the pinned {CODEC_REVISION}.\n"
            "Update CODEC_REVISION on purpose, then regenerate and hear every file (--all)."
        )

    from vieneu import Vieneu

    tts = Vieneu(
        mode="v3turbo",
        backend="onnx",
        precision="fp32",
        backbone_repo=model_dir,
        onnx_dir=str(Path(model_dir) / ONNX_SUBFOLDER),
    )
    if tts.sample_rate != SAMPLE_RATE:
        sys.exit(f"expected {SAMPLE_RATE} Hz from the model, got {tts.sample_rate}")
    return tts


def synthesise(tts, voice: Voice, text: str, path: Path) -> None:
    import numpy as np
    import pyloudnorm
    import soundfile

    # No watermark (ADR 0014, decision 7); the voice menu discloses the AI voices instead.
    audio = np.asarray(
        tts.infer(text, voice=voice.preset, temperature=TEMPERATURE, apply_watermark=False),
        dtype=np.float32,
    )
    measured = pyloudnorm.Meter(SAMPLE_RATE).integrated_loudness(audio)
    audio = audio * loudness_gain(measured, float(np.max(np.abs(audio))), TARGET_LUFS, CEILING_DBFS)
    path.parent.mkdir(parents=True, exist_ok=True)
    soundfile.write(path, audio, SAMPLE_RATE, format="OGG", subtype="OPUS")


# --- CLI ----------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--injury", default="itbs")
    parser.add_argument("--all", action="store_true", help="regenerate every line, not only stale ones")
    parser.add_argument("--dry-run", action="store_true", help="list what would change and stop")
    args = parser.parse_args(argv)

    tour = json.loads((ROOT / "content/injuries" / args.injury / "tour.json").read_text("utf-8"))
    out = ROOT / "apps/web/public/narration" / args.injury
    manifest_path = out / "manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8")) if manifest_path.exists() else empty_manifest()
    files = {(p.parent.name, p.stem) for p in out.glob("*/*.ogg")}

    lines = tour_lines(tour)
    texts = dict(lines)
    todo, orphans = plan(lines, manifest, VOICES, files, force=args.all)
    for voice_id, line_id in orphans:
        print(f"remove   {voice_id}/{line_id}.ogg (line is gone from tour.json)")
    for voice_id, line_id in todo:
        print(f"generate {voice_id}/{line_id}.ogg")
    if args.dry_run or not (todo or orphans):
        print("nothing to do" if not (todo or orphans) else "dry run: nothing written")
        return

    def save() -> None:
        out.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", "utf-8")

    for voice_id, line_id in orphans:
        (out / voice_id / f"{line_id}.ogg").unlink(missing_ok=True)
        forget(manifest, voice_id, line_id)
    save()

    if todo:
        tts = load_tts()
        for n, (voice_id, line_id) in enumerate(todo, 1):
            voice = VOICES[voice_id]
            synthesise(tts, voice, texts[line_id], out / voice_id / f"{line_id}.ogg")
            record(manifest, voice_id, voice, line_id, texts[line_id])
            save()  # after every line, so an interrupted run keeps what it made
            print(f"[{n}/{len(todo)}] {voice_id}/{line_id}.ogg")

    print(f"\n{len(todo)} file(s) written. Listen to every one before committing (ADR 0014).")


if __name__ == "__main__":
    main()
