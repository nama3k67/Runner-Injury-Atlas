# Tour narration

Turns the lines of `content/injuries/<injury>/tour.json` into recorded narration with
VieNeu-TTS v3 Turbo, one Ogg Opus file per line per voice ([ADR 0014](../../docs/adr/0014-tour-narration-with-vieneu-tts.md)).
Run by hand, like `tools/anatomy-pipeline`. Nothing runs the model in CI or in the browser.

## Install

Needs Python 3.10 or later, about 1 GB of downloads (SDK, ONNX Runtime, model and codec) and a
CPU fast enough to run the model. No GPU and no API key.

```bash
cd tools/narration
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

The first run downloads the model and the codec from Hugging Face into its usual cache
(`~/.cache/huggingface`). After that, generation makes no network calls except a check of the
codec's revision.

## Run

From the repo root:

```bash
tools/narration/.venv/bin/python tools/narration/generate.py --dry-run   # list what would change
tools/narration/.venv/bin/python tools/narration/generate.py             # generate stale or missing lines
tools/narration/.venv/bin/python tools/narration/generate.py --all       # regenerate every line
```

By default only stale or missing lines are generated. Sampling makes every run sound slightly
different, so lines that did not change are left as they are. A line is stale when its text,
or any generator setting, differs from what the manifest recorded. Files for lines that are
gone from `tour.json` are deleted.

## Every new file must be heard before it ships

A mispronounced medical term is a content error (ADR 0014, decision 5). After a run:

1. Listen to every file the tool printed as written.
2. Regenerate a bad line by deleting its file and running again.
3. Open a `content` PR that lists every new or changed file. The maintainer hears each one.

## Output

```
apps/web/public/narration/<injury>/
  manifest.json
  <voice id>/<line id>.ogg      for example ngoc-huyen/s1-l1.ogg
```

- **Audio:** mono, 48 kHz, Ogg Opus.
- **Loudness:** normalised to -16 LUFS with the sample peak at or below -1 dBFS, so every voice
  plays at the same level.
- **No watermark:** the tour's voice menu says the voices are AI-generated (ADR 0014, decision 7).

`manifest.json` is read by the stale-audio check (#54) and by the voice menu (#55):

```json
{
  "voices": {
    "ngoc-huyen": {
      "label": "Ngọc Huyền (nữ, giọng Bắc)",
      "lines": {
        "s1-l1": {
          "textSha256": "<sha256 hex of the line text, UTF-8, exactly as in tour.json>",
          "settings": {
            "sdk": "vieneu==3.8.5",
            "model": "pnnbao-ump/VieNeu-TTS-v3-Turbo@<revision>",
            "codec": "OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX@<revision>",
            "precision": "fp32",
            "preset": "Ngọc Huyền",
            "temperature": 0.8,
            "loudnessLufs": -16,
            "format": "ogg-opus"
          }
        }
      }
    }
  }
}
```

The file of a line is `<voice id>/<line id>.ogg`, next to the manifest.

## Pinned versions

`generate.py` pins the `vieneu` SDK version and the Hugging Face revisions of the model and the
codec, and uses the fp32 ONNX graphs.

- **Model.** The SDK has no revision parameter, so the tool downloads the model at the pinned
  revision and loads it from that local snapshot.
- **Codec.** The SDK always fetches the codec from the main branch of its repo. The tool stops
  if main is not at the pinned revision.

To move to a new version, change the constant on purpose, run with `--all`, and hear every file
again.

Voices and their labels are in `VOICES` in `generate.py` (picked in #28).

## Tests

The pure logic (hashing, which lines are stale, loudness gain, manifest updates) has unit
tests that need only the standard library:

```bash
python3 -m unittest discover tools/narration
```
