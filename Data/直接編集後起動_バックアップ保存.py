"""pokemon_list / move_list / poke_movelist を _back.csv へバックアップする。"""

import shutil
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent

BACKUP_PAIRS = (
    ("pokemon_list.csv", "pokemon_list_back.csv"),
    ("move_list.csv", "move_list_back.csv"),
    ("poke_movelist.csv", "poke_movelist_back.csv"),
)


def main() -> int:
    ok = 0
    for src_name, dst_name in BACKUP_PAIRS:
        src = DATA_DIR / src_name
        dst = DATA_DIR / dst_name
        if not src.is_file():
            print(f"[スキップ] {src_name} が見つかりません")
            continue
        shutil.copy2(src, dst)
        print(f"[保存] {src_name} → {dst_name}")
        ok += 1

    if ok == 0:
        print("バックアップ対象がありませんでした。")
        return 1

    print(f"バックアップ完了（{ok} 件）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
