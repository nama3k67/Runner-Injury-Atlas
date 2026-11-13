# Third-party notices

## BodyParts3D

The anatomical meshes in `apps/web/public/anatomy/leg-right.glb` and the model embedded in
`apps/web/public/legacy/v0.3/anatomy.js` are derived from **BodyParts3D**,
© The Database Center for Life Science (DBCLS), licensed under
[CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).

- Source: STL export of BodyParts3D v3.0 mirrored at
  <https://github.com/Kevin-Mattheus-Moerman/BodyParts3D>
- Reference: Mitsuhashi N, et al. _BodyParts3D: 3D structure database for anatomical
  concepts._ Nucleic Acids Res. 2009;37:D782–5.
- Changes made: 27 structures of the right lower limb and pelvis selected; meshes decimated;
  coordinates converted to centimetres, Y up, origin at the knee flexion axis; landmark
  metadata computed (hip centre, knee axis, lateral epicondyle, Gerdy's tubercle). See
  `tools/anatomy-pipeline/`.
- The derived meshes and metadata are shared under the same licence (CC BY-SA 2.1 Japan).

The fat pad, Kaplan fibres and compression arrows shown in the simulation are **not** part
of BodyParts3D. They are illustrative shapes added by this project.
