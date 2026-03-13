import os

# 現在のフォルダ
folder = os.path.dirname(os.path.abspath(__file__))

for filename in os.listdir(folder):

    path = os.path.join(folder, filename)

    # ファイルのみ対象
    if os.path.isfile(path):

        # ファイル名に "s" が含まれていたら削除
        if "s" in filename:
            os.remove(path)
            print("削除:", filename)

print("完了しました")