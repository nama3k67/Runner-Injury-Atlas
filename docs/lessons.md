# Lessons learned

Things that went wrong or surprised us, and the rule we follow because of them. Newest
first. Add an entry when a fix teaches something that the code alone does not show.

Each entry: what happened, why, what we changed, and the rule from now on. If a rule starts
to matter a lot, move it down the harness table in `docs/process.md` (a helper, a lint rule,
a test) instead of leaving it here as advice.

## 2026-11-22 — Multi-step 3D e2e tests run out of the 30 s budget on CI

**What happened.** PR #8 (picking) passed e2e locally but failed CI: three picking tests timed
out on desktop and mobile, on retry too. The errors looked like a hang ("Received: ''",
`mouse.move` timeouts).

**Why.** The CI trace showed no hang. Every Playwright action took about 1.1–1.7 s, including
the first `expect` before any interaction, and the canvas `boundingBox` took 4.5 s. Add the
9.3 s first-load wait, and the click test reached 30.0 s exactly. Locally the same steps take
milliseconds. Our reading is that each action waits on a rendered frame, and the leg scene
renders slowly on SwiftShader. That is inferred from the trace, not profiled. Older tests
passed because they have few steps.

Measured on: GitHub Actions runner, Chrome with SwiftShader, cold browser, production build.
Forcing SwiftShader locally (Mac, `--use-angle=swiftshader`, production build) runs the same
tests in about 4 s each, so a local run does not reproduce the CI cost. Only CI proves the budget.

**What we changed.** The picking `describe` calls `test.slow()` (90 s budget). The assertions
did not change.

**Rules from now on.**

- Budget a 3D e2e test at roughly 1.5 s per action on CI, on top of the first-load stall.
  Mark a test `test.slow()` when it does more than a handful of actions on the scene.
- An error that looks like a hang (empty text, input timeouts) is often a timeout hit halfway
  through. Add up the action durations in the trace before you suspect the app.

**Open.** Rendering on demand (`frameloop="demand"`) would cut the per-frame cost on CI and
the battery use on phones. See
[#22](https://github.com/nama3k67/runner-injury-atlas/issues/22).

## 2026-11-22 — The first 3D scene load stalls the main thread; e2e must wait for readiness

**What happened.** PR #4 failed CI. The test _ITBS page renders the R3F scene_ could not find
`<canvas>` within the default 5 s (desktop failed twice, mobile was flaky). The same test had
passed on every earlier run and passed locally.

**Why.** The CI trace showed the canvas mounting at about 0.7 s, then the page not responding
until about 6.5 s. The first scene in a fresh browser runs one long main-thread task. Playwright
cannot query the DOM while that task runs, so it reported its last result: "element(s) not
found". On CI's software GL (SwiftShader) the stall can exceed 5 s. Retries did not help,
because each retry starts a new browser with cold caches.

Measured locally on production builds (Mac, Chrome forced to SwiftShader, not the real GPU):

| Build  | First load: longest task | First load: ready | Later loads: longest task |
| ------ | ------------------------ | ----------------- | ------------------------- |
| `main` | about 2.5 s              | about 5.4 s       | 0.1–0.4 s                 |
| PR #4  | about 2.7 s              | about 5.6 s       | about 0.2 s               |

6x CPU throttling barely changed the first-load stall. So the cost is probably cold shader
compilation rather than our JS, but that is an inference: it was not profiled. The stall
existed before PR #4, which only made it visible.

**What we changed.** The test now waits for `data-state="ready"` (20 s budget) before
asserting the canvas. The assertions are the same; only the order changed (`e9d463a`).

**Rules from now on.**

- In e2e, wait for the app's own readiness signal before querying anything inside or next
  to the 3D scene. A 5 s DOM query that runs during the first load is a flaky test.
- When a test fails only on CI, read the trace timeline before touching the test. A "not
  found" can mean "the page was blocked", not "the element is missing".
- Report every performance number with the conditions it was measured under (build, device,
  GPU or software GL, cold or warm). A number from SwiftShader says nothing about a real GPU.
  The first write-up of this incident called the 2.5 s "on the Mac" and had to be corrected.

**Open.** Real-GPU and real-phone numbers are not measured yet. See
[#21](https://github.com/nama3k67/runner-injury-atlas/issues/21).
