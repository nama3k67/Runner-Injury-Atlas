# Backlog

Known gaps, in rough priority order. Each becomes an issue with acceptance criteria when
picked up. Phases refer to the roadmap in the project plan.

## Phase 1 — reach parity with v0.3 inside the repo (gate 1)

- [x] **Port the 3D rig to React Three Fiber.** GLB + meta, 3-bone skeleton, skin weights,
      ITB colour/morph and fat pad from `@atlas/sim`, knee and hip-drop sliders.
- [ ] **Finish the R3F scene.** Still missing: tension colouring, labels, camera presets
      (refit on resize, and applying a term's `scene` hint). Done: Kaplan fibres, arrows and
      pelvic bar; layer toggles; picking that opens the dictionary term. Then remove the
      "Xem bản v0.3" link.
- [x] **Zustand store for simulation state** (`apps/web/src/simStore.ts`, knee angle and hip
      drop). Selection joined with picking; run mode and tour state join in the PRs that add the gait
      chart and the tour runner.
- [ ] **Guided tour runner driven by `tour.json`**, using the browser voice until recorded
      audio exists.
- [ ] **Gait chart** from `simulation.json` (currently only in the legacy page).
- [ ] **Move long-form ITBS sections to content** (mechanism, causes, symptoms and
      differential, clinical tests). They exist only in `legacy/v0.3/index.html`. Sources
      r10 and r14 are cited only there.
- [ ] **Visual regression snapshots** of the 3D scene at fixed camera/angle presets.
- [ ] **Test on real phones** and record frame rate; decide on a reduced-detail mode.
      Start from the first-load stall in `docs/lessons.md` (2026-11-22).
- [ ] **Load the fonts** (Be Vietnam Pro, JetBrains Mono). v0.3 pulled them from Google Fonts;
      the app falls back to system fonts. Self-hosting avoids sending readers' IPs to Google.
- [ ] **Port the anatomy pipeline to TypeScript** (gltf-transform, meshopt) so it runs in CI.
- [ ] **Run the API against real Postgres** (docker compose) and add it to CI as a service.
      Only PGlite has been exercised so far.
- [ ] **OpenAPI document** generated from `packages/contracts`.

## Phase 2 — content as data, narration, clinical review (gate 2: publish)

- [ ] Recorded Vietnamese narration, one file per tour line (service still to be chosen).
- [ ] Reviewer authentication to replace the shared admin key (ADR 0005).
- [ ] Reviewer UI: read the content, see the hash, approve or request changes.
- [ ] CI check that a `published` injury's stamp matches an approved review in the API.
- [ ] Find a physiotherapist or sports-medicine doctor to review ITBS.
- [ ] Deployment (web static host, API host, managed Postgres) and a release workflow.
- [ ] Choose a licence for the code; choose the product name and domain.

## Phase 3 and later

- [ ] Second and third injuries (patellofemoral pain, Achilles tendinopathy) via `/add-injury`.
- [ ] Shared dictionary route `/tu-dien`.
- [ ] Gait analysis from phone video, on device (pose estimation), feeding the simulation.
- [ ] English translation.

## Content warnings to resolve

`pnpm validate:content` currently warns: terms `bf`, `rf`, `vl` make claims without a
source; sources `r10` and `r14` are not cited from structured content.
