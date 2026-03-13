import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageTk
import os

# =========================
# 設定（ここを調整）
# =========================

# 画像を開くときの既定フォルダ
OPEN_DEFAULT_DIR = r"G:\マイドライブ\共有用\ク6-3ナツール"

# 保存するときの既定フォルダ
SAVE_DEFAULT_DIR = r"C:\Users\write\Root\作成ツール\ku6-3naTool\image\Match"

# 切り出すグリッド
GRID_COLUMNS = 3
GRID_ROWS = 4

# 最初のポケモンの左上座標
START_X = 100
START_Y = 655

# 横と縦の間隔
X_SPACING = 375
Y_SPACING = 425

# 切り出しサイズ
CROP_WIDTH = 240
CROP_HEIGHT = 210

# 表示サムネイル最大サイズ（縦横比維持）
THUMBNAIL_SIZE = 150

# =========================


class PokemonCropTool:

    def __init__(self, root):
        self.root = root
        self.root.title("ポケモン素材切り出しツール")

        load_button = tk.Button(root, text="画像を読み込む", command=self.load_image)
        load_button.pack(pady=10)

        self.frame = tk.Frame(root)
        self.frame.pack()

        self.crops = []

    def load_image(self):

        path = filedialog.askopenfilename(
            initialdir=OPEN_DEFAULT_DIR if OPEN_DEFAULT_DIR else None,
            filetypes=[("Image files", "*.png *.jpg *.jpeg")]
        )

        if not path:
            return

        self.image = Image.open(path)

        self.generate_crops()

    def generate_crops(self):

        for widget in self.frame.winfo_children():
            widget.destroy()

        self.crops = []

        for row in range(GRID_ROWS):
            for col in range(GRID_COLUMNS):

                x = START_X + col * X_SPACING
                y = START_Y + row * Y_SPACING

                crop = self.image.crop(
                    (x, y, x + CROP_WIDTH, y + CROP_HEIGHT)
                )

                self.crops.append(crop)

                # 縦横比を保ったサムネイル
                thumb = crop.copy()
                thumb.thumbnail((THUMBNAIL_SIZE, THUMBNAIL_SIZE))

                photo = ImageTk.PhotoImage(thumb)

                frame = tk.Frame(self.frame)
                frame.grid(row=row, column=col, padx=10, pady=10)

                label = tk.Label(frame, image=photo)
                label.image = photo
                label.pack()

                btn = tk.Button(
                    frame,
                    text="保存",
                    command=lambda c=crop: self.save_crop(c)
                )
                btn.pack(pady=5)

    def save_crop(self, crop):

        path = filedialog.asksaveasfilename(
            initialdir=SAVE_DEFAULT_DIR if SAVE_DEFAULT_DIR else None,
            defaultextension=".png",
            filetypes=[("PNG", "*.png")]
        )

        if path:
            crop.save(path)


# =========================

root = tk.Tk()
app = PokemonCropTool(root)

root.mainloop()