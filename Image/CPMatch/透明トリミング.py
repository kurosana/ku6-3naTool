import os
from PIL import Image

# =========================
# 基本設定
# =========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

png_files = [f for f in os.listdir(BASE_DIR) if f.lower().endswith(".png")]

# =========================
# トリミング処理
# =========================

for filename in png_files:

    path = os.path.join(BASE_DIR, filename)

    img = Image.open(path).convert("RGBA")

    # アルファチャンネル取得
    alpha = img.split()[3]

    # 透明でない範囲取得
    bbox = alpha.getbbox()

    if bbox is None:
        print(f"{filename} は完全透明のためスキップ")
        continue

    cropped = img.crop(bbox)

    cropped.save(path)

    print(f"{filename} をトリミングしました")

print("処理完了")