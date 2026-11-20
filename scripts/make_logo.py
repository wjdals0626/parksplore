"""팍스플로어 로고: 흰 배경 제거(투명) + 여백 정리 -> 헤더 로고/파비콘/터치아이콘"""
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB"); a = np.asarray(im).astype(np.float32)
# 흰색과의 거리로 알파 계산(안티앨리어싱 보존), 색은 흰색 혼합분 제거
d = 255 - a.min(axis=2)                        # 0(흰색) ~ 255
alpha = np.clip(d * 1.6, 0, 255)
al = np.maximum(alpha / 255, 1e-3)[..., None]
rgb = np.clip((a - 255 * (1 - al)) / al, 0, 255)
rgba = np.dstack([rgb, alpha]).astype(np.uint8)
img = Image.fromarray(rgba, "RGBA")
bbox = img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
img = img.crop(bbox)
w, h = img.size; side = int(max(w, h) * 1.06)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0)); sq.paste(img, ((side - w) // 2, (side - h) // 2))
sq.resize((256, 256), Image.LANCZOS).save(f"{out}/logo.png")
sq.resize((64, 64), Image.LANCZOS).save(f"{out}/favicon-64.png")
sq.resize((32, 32), Image.LANCZOS).save(f"{out}/favicon-32.png")
touch = Image.new("RGBA", (180, 180), (255, 255, 255, 255)); t = sq.resize((150, 150), Image.LANCZOS); touch.alpha_composite(t, (15, 15))
touch.convert("RGB").save(f"{out}/apple-touch-icon.png")
print("bbox", bbox, "->", side)
