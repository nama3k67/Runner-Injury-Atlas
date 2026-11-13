---

description: Scaffold a new injury as data, following the six-step content process
argument-hint: <slug> <Vietnamese name>
---

Add the injury: $ARGUMENTS

1. **Scope.** Propose the main simulation (what the reader should understand by moving one
   control) and the BodyParts3D structures needed. Stop for confirmation.
2. **Sources.** Collect systematic reviews, anatomy and biomechanics studies, and clinician
   guidance. Open each source; a search snippet is not a source. Add them to
   content/sources.json with the next free ids.
3. **Draft.** Create content/injuries/<slug>/ with injury.json (status "draft", review null),
   rehab.json, myths.json, tour.json, simulation.json, and terms under content/terms/. Every
   claim cites [^rN]. Rehab phases advance by criteria, never by dates.
4. **Simulate.** If the scene needs code beyond data, list it as separate issues; do not mix
   it into the content PR.
5. **Validate.** `pnpm check`, then run the `content-auditor` subagent and address findings.
6. **Hand over.** Print the content hash from `pnpm validate:content` and stop.

You never set status "published" and never write a review stamp. A human does that after a
clinician approves this exact content hash.
