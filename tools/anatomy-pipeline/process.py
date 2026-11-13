"""Convert selected BodyParts3D STL meshes into one web-ready GLB + metadata.
Coordinate change: BP3D (mm, Z up, right side = -X, anterior = -Y)
 -> three.js (cm, Y up): x = -X/10 (lateral of right leg = +x), y = Z/10, z = Y/10 (anterior = -z)
 This map has det=+1 (proper rotation), so the right leg stays a right leg.
Origin is then moved to the knee flexion pivot.
"""
import json, numpy as np, trimesh, fast_simplification as fs
SRC = 'repo/assets/BodyParts3D_data/stl/'
PARTS = {  # key: (FMA id, target faces, group)
  'pelvisR': (16586, 9000, 'bone'), 'pelvisL': (16587, 6000, 'bone'), 'sacrum': (16202, 7000, 'bone'),
  'femur': (24474, 11000, 'bone'), 'patella': (24486, 1300, 'bone'), 'tibia': (24477, 6800, 'bone'),
  'fibula': (24480, 4000, 'bone'),
  'talus': (24482, 2000, 'bone'), 'calcaneus': (24497, 2000, 'bone'), 'navicular': (24500, 1200, 'bone'),
  'cuboid': (24528, 1200, 'bone'), 'cun1': (24521, 900, 'bone'), 'cun2': (24523, 700, 'bone'), 'cun3': (24525, 700, 'bone'),
  'mt1': (24507, 1200, 'bone'), 'mt2': (24509, 1000, 'bone'), 'mt3': (24511, 1000, 'bone'), 'mt4': (24513, 1000, 'bone'), 'mt5': (24515, 1000, 'bone'),
  'gmax': (22328, 9000, 'muscle'), 'gmed': (22330, 8000, 'muscle'), 'tfl': (22425, 4000, 'muscle'),
  'vl': (38930, 10000, 'muscle'), 'rf': (38928, 7000, 'muscle'), 'bfl': (45888, 6000, 'muscle'), 'bfs': (45891, 3000, 'muscle'),
  'itb': (58776, 22000, 'itb'),
}
def to3(v):
    v = np.asarray(v, float)
    return np.stack([-v[:, 0], v[:, 2], v[:, 1]], 1) / 10.0

meshes = {}
for k, (fid, target, grp) in PARTS.items():
    m = trimesh.load(f'{SRC}FMA{fid}.stl')
    m.merge_vertices()
    v, f = m.vertices, m.faces
    if len(f) > target:
        v, f = fs.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=1 - target / len(f))
    mm = trimesh.Trimesh(to3(v), f, process=True)
    mm.merge_vertices(); mm.remove_unreferenced_vertices()
    # keep largest components only for ITB (drop stray fragments) and fix winding
    trimesh.repair.fix_normals(mm, multibody=True)
    meshes[k] = mm
    print(k, len(f), '->', len(mm.faces))

fem = meshes['femur'].vertices
# hip centre: least-squares sphere fit on femoral head (medial = -x side, top)
top = fem[:, 1].max()
head = fem[(fem[:, 1] > top - 5.5) & (fem[:, 0] < np.percentile(fem[:, 0], 45))]
A = np.c_[2 * head, np.ones(len(head))]; b = (head ** 2).sum(1)
c = np.linalg.lstsq(A, b, rcond=None)[0]; hip = c[:3]; hipR = np.sqrt(c[3] + (hip ** 2).sum())
# knee: epicondyles = most lateral / most medial femur points in distal band
fbot = fem[:, 1].min()
band = fem[(fem[:, 1] > fbot + 1.2) & (fem[:, 1] < fbot + 6.0)]
lfe = band[band[:, 0].argmax()]; mfe = band[band[:, 0].argmin()]
pivot = (lfe + mfe) / 2; axis = (lfe - mfe); axis /= np.linalg.norm(axis)
# tibia landmarks
tib = meshes['tibia'].vertices; ttop = tib[:, 1].max()
tb = tib[(tib[:, 1] < ttop - 1.5) & (tib[:, 1] > ttop - 4.0)]
score = tb[:, 0] * 0.55 - tb[:, 2] * 0.85  # lateral(+x) & anterior(-z)
gerdy = tb[score.argmax()]
# ITB distal: nearest ITB point lateral of LFE -> fat pad between
itbv = meshes['itb'].vertices
near = itbv[np.abs(itbv[:, 1] - lfe[1]) < 1.2]
near = near[np.abs(near[:, 2] - lfe[2]) < 2.0]
itb_at_lfe = near[near[:, 0].argmin()] if len(near) else lfe + [0.6, 0, 0]
crest = meshes['pelvisR'].vertices; crest_top = crest[crest[:, 1].argmax()]

shift = -pivot
for m in meshes.values(): m.apply_translation(shift)
P = lambda p: (np.asarray(p) + shift).round(3).tolist()
meta = dict(hip=P(hip), hipR=round(float(hipR), 2), pivot=[0, 0, 0], axis=axis.round(4).tolist(), lfe=P(lfe), mfe=P(mfe), gerdy=P(gerdy),
            itbAtLfe=P(itb_at_lfe), crestTop=P(crest_top), parts={k: PARTS[k][2] for k in PARTS}, anchors={})
# label anchors: most lateral point of each part at a characteristic height
for k in ['gmax', 'gmed', 'tfl', 'vl', 'itb', 'rf', 'bfl']:
    v = meshes[k].vertices; ymid = np.percentile(v[:, 1], 60 if k != 'itb' else 45)
    sl = v[np.abs(v[:, 1] - ymid) < 1.5]
    meta['anchors'][k] = (sl[sl[:, 0].argmax()] + [1.5, 0, 0]).round(2).tolist()
for k, m in meshes.items():
    b = m.bounds; meta.setdefault('bounds', {})[k] = b.round(2).tolist()
print(json.dumps({k: meta[k] for k in ['hip', 'hipR', 'axis', 'lfe', 'mfe', 'gerdy', 'itbAtLfe', 'crestTop']}, indent=0))
scene = trimesh.Scene()
for k, m in meshes.items(): scene.add_geometry(m, node_name=k, geom_name=k)
glb = scene.export(file_type='glb')
open('anatomy.glb', 'wb').write(glb); json.dump(meta, open('meta.json', 'w'))
print('GLB MB', round(len(glb) / 1e6, 2))
