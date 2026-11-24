# Roadmap

Open work is tracked as GitHub issues, one milestone per phase (ADR 0010). This page describes
what each phase is for and the gate that ends it. To see what is left in a phase, run
`gh issue list --milestone "Phase 1"` or open the milestone.

## Phase 1: reach parity with v0.3 inside the repo (gate 1)

[Milestone](https://github.com/nama3k67/runner-injury-atlas/milestone/1)

Everything the frozen v0.3 prototype does runs in the app itself. That covers the 3D scene and
its controls, the guided tour, the gait chart and the long-form ITBS sections. The scene is
fast enough on real phones, and the stack is proven outside PGlite. **Gate:** the "Xem bản
v0.3" link is gone ([#16](https://github.com/nama3k67/runner-injury-atlas/issues/16)).

## Phase 2: content as data, narration, clinical review (gate 2: publish)

[Milestone](https://github.com/nama3k67/runner-injury-atlas/milestone/2)

Content can be reviewed and published for real. Individual reviewers record decisions in a
reviewer UI, CI checks that published content matches an approved review, and the tour has
recorded Vietnamese narration. The app is deployed, and the licence and name are settled.
**Gate:** a clinician approves the ITBS content hash and the maintainer publishes it.

## Phase 3 and later

[Milestone](https://github.com/nama3k67/runner-injury-atlas/milestone/3)

Goals, not yet specified as issues. Each one becomes an issue with acceptance criteria when it
is picked up.

- More injuries through `/add-injury`: patellofemoral pain, Achilles tendinopathy.
- A shared dictionary route, `/tu-dien`.
- Gait analysis from phone video, on the device (pose estimation), feeding the simulation.
- An English translation.
