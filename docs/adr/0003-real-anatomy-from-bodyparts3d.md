# 3. Real anatomy from BodyParts3D, with labelled synthetic additions

- Status: Accepted
- Date: 2026-11-13

## Context

The first prototype used stylised shapes. The maintainer asked for visuals that look like a real body. Commercial anatomy models are expensive and restrict redistribution.

## Decision

Use BodyParts3D v3.0 (DBCLS, CC BY-SA 2.1 Japan). A pipeline selects the structures an injury needs, decimates them, converts coordinates and computes landmarks (hip centre from a sphere fit of the femoral head, knee axis through the epicondyles). Structures the dataset lacks (ITB fat pad, Kaplan fibres) are drawn as synthetic shapes and labelled as illustrations on the page and in `NOTICE.md`.

## Consequences

- Anatomically real geometry from a citable scientific source.
- Share-alike: derived meshes must carry the same licence. Acceptable because the project is non-commercial (decided 2026-11-12). Revisit BodyParts3D 4.0 if that changes.
- The model is one adult male; it does not represent anatomical variation, and the page says so.
- Knee motion is a simplified hinge plus tibial rotation, not a biomechanical model.
