# Anatomy pipeline

Turns BodyParts3D STL meshes into the web-ready model in
`apps/web/public/anatomy/leg-right.glb` and its landmark file `leg-right.meta.json`.

Run by hand when the set of structures changes. Not part of `pnpm check` yet; porting it
to TypeScript (gltf-transform + meshopt) is on the backlog so it can run in CI.

```bash
# 1. Fetch only the STL files listed in PARTS (sparse checkout keeps this small)
git clone --filter=blob:none --no-checkout --depth 1 \
  https://github.com/Kevin-Mattheus-Moerman/BodyParts3D.git repo
# checkout assets/BodyParts3D_data/stl/FMA<id>.stl for each id in process.py

# 2. Process
pip install trimesh fast-simplification numpy
python3 process.py        # writes anatomy.glb and meta.json next to the script
```

What `process.py` does:

1. Decimates each mesh to a per-part triangle budget (about 160k triangles in total).
2. Converts BodyParts3D coordinates (mm, Z up) to centimetres, Y up, keeping the right leg
   a right leg (a proper rotation, not a mirror).
3. Computes landmarks: hip joint centre (least-squares sphere fit of the femoral head),
   knee flexion axis (line through the femoral epicondyles), lateral epicondyle, Gerdy's
   tubercle, iliac crest.
4. Moves the origin to the knee pivot and exports one GLB with a named node per structure.

Licence of the input and output: CC BY-SA 2.1 Japan, see `NOTICE.md`.
