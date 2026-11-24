---

paths:

- "apps/web/e2e/**"
- "apps/web/playwright.config.ts"

---

# Browser tests around the 3D scene

From `docs/lessons.md` (L1, L2). Read the entry before changing a flaky or CI-only test.

- Wait for the scene's own readiness signal (`data-state="ready"` on the `sim-stage` test
  id, 20 s budget) before querying anything inside or next to the scene. The first load
  blocks the main thread, and a short DOM query then reports "not found".
- Budget about 1.5 s per action on CI (SwiftShader), plus the first-load stall. A test with
  more than a handful of scene actions calls `test.slow()`.
- A failure that looks like a hang is often a timeout hit halfway. Add up the action
  durations in the CI trace before suspecting the app. A local run does not reproduce the CI
  cost, even with SwiftShader forced.
- Report a performance number with the conditions it was measured under: build, device, GPU
  or software GL, cold or warm.
