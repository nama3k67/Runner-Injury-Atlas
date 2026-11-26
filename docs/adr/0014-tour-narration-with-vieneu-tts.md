# 14. Tour narration: pre-generated with VieNeu-TTS, several voices, browser voice as fallback

- Status: Accepted
- Date: 2026-11-26
- Issue: #28

## Context

The guided tour (#17, `content/injuries/itbs/tour.json`) has 37 lines in Vietnamese. The v0.3
prototype reads them with the browser's `speechSynthesis`. That voice differs on every device,
and some devices have no Vietnamese voice at all. The maintainer also wants readers to pick
from several voices. A voice picker adds little to understanding, but it makes the tour more
fun to use.

The constraints:

- **Static-first (ADR 0004).** Pages must work without the API, so narration cannot depend on
  a server at reading time.
- **No reader data (ADR 0008).** A voice choice must not leave the reader's device.
- **Solo maintainer, no budget.** Nothing that bills per character or needs a key in CI.
- **Content is reviewed by humans (ADR 0006).** If a line is mispronounced, readers hear a
  medical term wrongly. Every audio file must be heard by a person before it ships.

What was considered:

- **Browser voice only.** Free, but it is the problem described above. Kept as the fallback.
- **Cloud TTS (Google, Azure, FPT.AI, Zalo).** Good Vietnamese voices. Rejected: it costs money
  per regeneration, needs a key, and ties the content pipeline to a vendor's terms for the output.
- **Recording a human narrator.** The best quality, but there is only one voice, and every edit
  to `tour.json` means booking a new recording.
- **VieNeu-TTS running in the reader's browser.** Rejected: it has no JS or WASM build, and the
  model is about 0.5 GB.
- **VieNeu-TTS behind our API or its OpenAI-compatible server.** Rejected: it breaks ADR 0004
  and needs a host that can run the model.
- **VieNeu-TTS v4.** Proprietary, and available only through the vieneu.io API.
- **VieNeu-TTS v3 Turbo, run by hand to generate files.** Chosen. Code and weights are
  Apache-2.0, and so is its audio codec (`OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano`). It runs on
  the maintainer's CPU with ONNX Runtime, with no GPU and no network calls after the model
  download. It ships 25 preset voices.

A trial on 2026-11-26 (Apple Silicon, ONNX fp32, `vieneu` 3.8.5) generated each line about three
times faster than real time, with a 5.5 s model load. Output was 48 kHz mono. Encoded as Ogg
Opus at the default bitrate, it took about 7 KB per second of audio, or about 1.2 MB for the
whole tour per voice. The int8 graphs were not tried: the SDK warns they need an x86 CPU with
VNNI, which Apple Silicon does not have.

## Decision

1. **Narration is generated offline and committed as files.** A Python tool in
   `tools/narration/`, run by hand like `tools/anatomy-pipeline`, reads `tour.json` and writes
   one Ogg Opus file per line per voice, named by line id (for example `s1-l1.ogg`). The files
   are served as static assets by the web app. Nothing runs the model at reading time or in CI.
2. **Pinned versions.** The tool pins the `vieneu` SDK version and the Hugging Face revision of
   both the model and the codec. It uses the fp32 ONNX graphs. At this ADR's date: `vieneu`
   3.8.5, model `pnnbao-ump/VieNeu-TTS-v3-Turbo` at `61b85e3d`, codec at `6aa02b01`.
3. **A manifest records what each file was made from.** For each voice and line, the manifest
   stores the hash of the line's text and the generator settings (SDK version, model revision,
   preset name, temperature). A check in `pnpm check` fails when a line's text does not
   match its hash, or when a voice lacks a file for a line. The check does not need the model.
4. **Several voices, few at first.** The maintainer picks three or four preset voices for the
   first release. Each voice gets a short slug id (for example `ngoc-huyen`) and a Vietnamese
   display label. Adding a voice later means generating it and hearing all of its lines.
5. **Every file is heard before it ships.** A PR that adds or regenerates audio is a `content`
   PR. The maintainer listens to each new or changed file, and the PR lists them. Only stale
   lines are regenerated, because sampling makes each run sound slightly different.
6. **The reader chooses, and the choice stays on the device.** The tour has a voice menu. The
   last option is the browser's own voice, which is also used when a file is missing or fails
   to load. The choice is stored in `localStorage` and sent nowhere.
7. **Disclosed, not watermarked.** The voice menu says the voices are AI-generated with
   VieNeu-TTS, which also satisfies Apache-2.0 attribution. The SDK's optional Perth watermark
   is not used: it adds a dependency, and the audio is our own public text, not an
   impersonation.
8. **Preset voices only.** No cloning of a real person's voice. Cloning would need written
   consent from that person, and would get its own ADR.

## Consequences

- Narration sounds the same on every device, and the tour works offline once loaded.
- No running cost and no keys. Regenerating is a local command that takes about a minute
  per voice.
- Listening is the real cost, and it grows with the number of voices. Four voices means
  148 files to hear at first, and every edit to a line means hearing it again in every voice.
- Binary files live in git. Four voices add about 5 MB, and each regeneration adds more to the
  history. Git LFS was not chosen, to keep the setup simple. Lowering the Opus bitrate for
  speech would cut the size further, but this has not been measured yet.
- The reader downloads only the voice they chose, so more voices do not slow the page.
- The rights to the preset voices rest on the model author's statement that the speakers
  consented. That statement has not been verified, and the training data is not public. If it
  turns out wrong, the affected voices are removed and regenerated with others.
- The tool needs Python, about 1 GB of downloads and a CPU fast enough to run the model. A
  contributor without that setup can still edit `tour.json`, but the check will report stale
  audio until the maintainer regenerates it.
- Playback depends on the tour runner (#17), so audio cannot be heard in the app before #17 lands.
