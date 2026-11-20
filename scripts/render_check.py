"""변환된 GLB 검증용 평면/단면 렌더 (matplotlib)."""
import sys, numpy as np, pygltflib as G, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
g = G.GLTF2().load(sys.argv[1]); blob = g.binary_blob()
def acc(i, dt, n):
    a = g.accessors[i]; bv = g.bufferViews[a.bufferView]
    return np.frombuffer(blob, dt, a.count * n, bv.byteOffset).reshape(-1, n) if n > 1 else np.frombuffer(blob, dt, a.count, bv.byteOffset)
fig, ax = plt.subplots(1, 2, figsize=(22, 11))
HL = {"slope": "red", "door": "blue", "chair": "orange", "sign": "green", "turnel": "purple", "fire": "magenta"}
for m in g.meshes:
    p = m.primitives[0]; pos = acc(p.attributes.POSITION, np.float32, 3); idx = acc(p.indices, np.uint32, 1).reshape(-1, 3)
    name = m.name.lower(); col = next((c for k, c in HL.items() if k in name), None)
    sel = idx if len(idx) < 60000 or col else idx[:: max(1, len(idx) // 60000)]
    tri = pos[sel]
    ax[0].add_collection(PolyCollection(tri[:, :, [0, 2]], facecolor=col or "0.6", edgecolor="none", alpha=0.9 if col else 0.05, zorder=3 if col else 1))
    ax[1].add_collection(PolyCollection(tri[:, :, [0, 1]], facecolor=col or "0.6", edgecolor="none", alpha=0.9 if col else 0.05, zorder=3 if col else 1))
for a, t in zip(ax, ["Top (x-z)", "Side (x-y)"]):
    a.autoscale(); a.set_aspect("equal"); a.set_title(t)
ax[0].invert_yaxis()
from matplotlib.patches import Patch
ax[0].legend(handles=[Patch(color=c, label=k) for k, c in HL.items()], loc="upper right")
plt.tight_layout(); plt.savefig(sys.argv[2], dpi=70)
