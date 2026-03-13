import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageTk
import os

# =========================
# 設定（初期値）
# =========================

OPEN_DEFAULT_DIR = r"G:\マイドライブ\共有用\ク6-3ナツール"
SAVE_DEFAULT_DIR = r"C:\Users\write\Root\作成ツール\ku6-3naTool\image\Match"

GRID_COLUMNS = 3
GRID_ROWS = 4

START_X_DEFAULT = 100
START_Y_DEFAULT = 655

X_SPACING_DEFAULT = 375
Y_SPACING_DEFAULT = 425

CROP_WIDTH_DEFAULT = 240
CROP_HEIGHT_DEFAULT = 210

THUMBNAIL_SIZE = 150


# パラメータメモ
# CP切り取り時　→　110-590-372-425-200-62

# =========================


class PokemonCropTool:

    def __init__(self, root):

        self.root = root
        self.root.title("ポケモン素材切り出しツール")

        self.image = None
        self.crops = []

        # =========================
        # 上部ボタン
        # =========================

        top_frame = tk.Frame(root)
        top_frame.pack(pady=10)

        load_button = tk.Button(top_frame, text="画像を読み込む", command=self.load_image)
        load_button.pack()

        # =========================
        # メインエリア（左右）
        # =========================

        main_frame = tk.Frame(root)
        main_frame.pack()

        # 左：切り出し画像
        self.crop_area = tk.Frame(main_frame)
        self.crop_area.pack(side=tk.LEFT, padx=10)

        # 右：パラメータ調整
        param_frame = tk.Frame(main_frame)
        param_frame.pack(side=tk.RIGHT, padx=10, anchor="n")

        # =========================
        # パラメータ変数
        # =========================

        self.start_x = tk.IntVar(value=START_X_DEFAULT)
        self.start_y = tk.IntVar(value=START_Y_DEFAULT)

        self.x_spacing = tk.IntVar(value=X_SPACING_DEFAULT)
        self.y_spacing = tk.IntVar(value=Y_SPACING_DEFAULT)

        self.crop_width = tk.IntVar(value=CROP_WIDTH_DEFAULT)
        self.crop_height = tk.IntVar(value=CROP_HEIGHT_DEFAULT)

        # =========================
        # パラメータUI
        # =========================

        self.create_param(param_frame, "START_X", self.start_x, 0)
        self.create_param(param_frame, "START_Y", self.start_y, 1)

        self.create_param(param_frame, "X_SPACING", self.x_spacing, 2)
        self.create_param(param_frame, "Y_SPACING", self.y_spacing, 3)

        self.create_param(param_frame, "CROP_WIDTH", self.crop_width, 4)
        self.create_param(param_frame, "CROP_HEIGHT", self.crop_height, 5)

        # 値変更でリアルタイム更新
        for var in [
            self.start_x,
            self.start_y,
            self.x_spacing,
            self.y_spacing,
            self.crop_width,
            self.crop_height
        ]:
            var.trace_add("write", self.on_param_change)

    # =========================

    def create_param(self, parent, label, var, row):

        tk.Label(parent, text=label).grid(row=row, column=0, padx=5, pady=4, sticky="w")

        entry = tk.Entry(parent, textvariable=var, width=8)
        entry.grid(row=row, column=1, padx=5)

    # =========================

    def on_param_change(self, *args):

        if self.image:
            self.generate_crops()

    # =========================

    def load_image(self):

        path = filedialog.askopenfilename(
            initialdir=OPEN_DEFAULT_DIR if OPEN_DEFAULT_DIR else None,
            filetypes=[("Image files", "*.png *.jpg *.jpeg")]
        )

        if not path:
            return

        self.image = Image.open(path)

        self.generate_crops()

    # =========================

    def generate_crops(self):

        for widget in self.crop_area.winfo_children():
            widget.destroy()

        self.crops = []

        start_x = self.start_x.get()
        start_y = self.start_y.get()

        x_spacing = self.x_spacing.get()
        y_spacing = self.y_spacing.get()

        crop_width = self.crop_width.get()
        crop_height = self.crop_height.get()

        for row in range(GRID_ROWS):
            for col in range(GRID_COLUMNS):

                x = start_x + col * x_spacing
                y = start_y + row * y_spacing

                crop = self.image.crop(
                    (x, y, x + crop_width, y + crop_height)
                )

                self.crops.append(crop)

                thumb = crop.copy()
                thumb.thumbnail((THUMBNAIL_SIZE, THUMBNAIL_SIZE))

                photo = ImageTk.PhotoImage(thumb)

                frame = tk.Frame(self.crop_area)
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

    # =========================

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