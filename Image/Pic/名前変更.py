import os
import re

# =========================
# 基本設定
# =========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

png_files = [f for f in os.listdir(BASE_DIR) if f.lower().endswith(".png")]

# 数字ごとにまとめる
groups = {}

pattern = re.compile(r'^(\d+)(.*)n(.*)\.png$', re.IGNORECASE)
simple_pattern = re.compile(r'^(\d+)n\.png$', re.IGNORECASE)

for filename in png_files:

    # (数字)n.png
    m_simple = simple_pattern.match(filename)
    if m_simple:
        num = m_simple.group(1)
        groups.setdefault(num, []).append(("simple", filename, ""))
        continue

    # その他 n を含む形式
    m = pattern.match(filename)
    if m:
        num = m.group(1)
        suffix = m.group(3)
        groups.setdefault(num, []).append(("variant", filename, suffix))

# =========================
# リネーム計画作成
# =========================

rename_plan = []

for num, files in groups.items():

    simple_files = [f for f in files if f[0] == "simple"]
    variant_files = [f for f in files if f[0] == "variant"]

    # simple → (数字).png
    for _, filename, _ in simple_files:
        new_name = f"{num}.png"
        rename_plan.append((filename, new_name))

    if not variant_files:
        continue

    suffixes = [(f[1], f[2]) for f in variant_files]

    letters = [s.upper() for _, s in suffixes]

    # 特例：M と D
    if "M" in letters and "D" in letters and len(letters) == 2 and simple_files:

        for filename, suffix in suffixes:

            if suffix.upper() == "M":
                new_name = f"{num}-1.png"
            else:
                new_name = f"{num}-2.png"

            rename_plan.append((filename, new_name))

        continue

    # 通常処理（アルファベット順）
    suffixes_sorted = sorted(
        suffixes,
        key=lambda x: x[1].upper() if x[1] else ""
    )

    # simpleが無い場合の特別処理
    if not simple_files:

        first = True
        index = 1

        for filename, suffix in suffixes_sorted:

            if first:
                new_name = f"{num}.png"
                first = False
            else:
                new_name = f"{num}-{index}.png"
                index += 1

            rename_plan.append((filename, new_name))

    else:

        index = 1

        for filename, suffix in suffixes_sorted:

            new_name = f"{num}-{index}.png"
            rename_plan.append((filename, new_name))

            index += 1

# =========================
# リネーム実行
# =========================

for old, new in rename_plan:

    old_path = os.path.join(BASE_DIR, old)
    new_path = os.path.join(BASE_DIR, new)

    print(f"{old} → {new}")

    os.rename(old_path, new_path)

print("一次リネーム完了")

# =========================
# 先頭の不要な0を削除
# =========================

files = os.listdir(BASE_DIR)

pattern = re.compile(r'^(\d+)(.*)\.png$')

for filename in files:

    m = pattern.match(filename)
    if not m:
        continue

    number_part = m.group(1)
    rest = m.group(2)

    new_number = str(int(number_part))
    new_name = f"{new_number}{rest}.png"

    if new_name == filename:
        continue

    old_path = os.path.join(BASE_DIR, filename)
    new_path = os.path.join(BASE_DIR, new_name)

    print(f"{filename} → {new_name}")

    os.rename(old_path, new_path)

print("先頭0整理完了")