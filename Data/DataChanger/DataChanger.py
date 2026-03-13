import tkinter as tk
from tkinter import ttk
import csv
import shutil
import os

# =========================
# ファイル
# =========================

MOVE_FILE = "move_list.csv"
MOVE_BACK = "move_list_back.csv"

POKE_MOVE_FILE = "poke_movelist.csv"
POKE_FILE = "pokemon_list.csv"
POKE_BACK = "pokemon_list_back.csv"

# =========================
# CSV読み込み
# =========================

def load_csv(path):
    data = []
    if not os.path.exists(path):
        return data
    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f)
        for r in reader:
            data.append(r)
    return data


def save_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)

# =========================
# バックアップ復元
# =========================

def restore_backup():

    if os.path.exists(MOVE_BACK) and os.path.exists(MOVE_FILE):

        move = load_csv(MOVE_FILE)
        back = load_csv(MOVE_BACK)

        back_map = {r[1]: r[3] for r in back if len(r) >= 4}

        for r in move:
            if len(r) >= 4 and r[1] in back_map:
                r[3] = back_map[r[1]]

        save_csv(MOVE_FILE, move)

    if os.path.exists(POKE_BACK) and os.path.exists(POKE_FILE):

        poke = load_csv(POKE_FILE)
        back = load_csv(POKE_BACK)

        back_map = {}

        for r in back:
            if len(r) >= 7:
                key = (r[0], r[1])
                back_map[key] = r[4:7]

        for r in poke:
            key = (r[0], r[1])
            if key in back_map:
                while len(r) < 7:
                    r.append("")
                r[4:7] = back_map[key]

        save_csv(POKE_FILE, poke)

# =========================
# 技リスト取得
# =========================

def load_pokemon_moves():

    data = load_csv(POKE_MOVE_FILE)

    move_map = {}

    for r in data:

        if len(r) < 4:
            continue

        flag = r[0]
        name = r[2]
        moves = r[3:]

        if name not in move_map:
            move_map[name] = {"fast": [], "charge": []}

        if flag == "0":
            move_map[name]["fast"] = moves
        else:
            move_map[name]["charge"] = moves

    return move_map

# =========================
# GUI
# =========================

class App:

    def __init__(self, root):

        self.root = root
        root.title("CSV編集ツール")
        root.geometry("1000x650")

        self.pokemon_data = load_csv(POKE_FILE)
        self.move_data = load_csv(MOVE_FILE)
        self.move_map = load_pokemon_moves()

        notebook = ttk.Notebook(root)
        notebook.pack(fill="both", expand=True)

        self.tab_pokemon = ttk.Frame(notebook)
        self.tab_move = ttk.Frame(notebook)

        notebook.add(self.tab_pokemon, text="デフォルト技カスタム")
        notebook.add(self.tab_move, text="わざ優先度設定")

        self.build_pokemon_tab()
        self.build_move_tab()

        self.status = tk.Label(root, text="")
        self.status.pack()

        self.show_status("バックアップを復元しました")

    # =========================

    def show_status(self, text):
        self.status.config(text=text)
        self.root.after(5000, lambda: self.status.config(text=""))

    # =========================
    # ポケモンタブ
    # =========================

    def build_pokemon_tab(self):

        frame = self.tab_pokemon

        left = tk.Frame(frame)
        right = tk.Frame(frame)

        left.pack(side="left", fill="y", padx=15, pady=15)
        right.pack(side="right", fill="both", expand=True, padx=30, pady=30)

        self.poke_search = tk.Entry(left, width=25)
        self.poke_search.pack(pady=5)

        self.poke_search.bind("<KeyRelease>", lambda e: self.search_pokemon())

        tk.Button(left, text="検索", command=self.search_pokemon).pack(pady=5)

        self.poke_listbox = tk.Listbox(left, width=30)
        self.poke_listbox.pack(fill="y", expand=True, pady=10)

        self.poke_listbox.bind("<<ListboxSelect>>", self.select_pokemon)

        self.target_name = tk.Label(right, text="ポケモン:", font=("Arial", 16))
        self.target_name.pack(pady=20)

        self.fast_var = tk.StringVar()
        self.charge1_var = tk.StringVar()
        self.charge2_var = tk.StringVar()

        self.current_fast = tk.Label(right, text="現在：")
        self.current_charge1 = tk.Label(right, text="現在：")
        self.current_charge2 = tk.Label(right, text="現在：")

        self.create_edit_row(right, "通常技", self.fast_var, self.current_fast)
        self.create_edit_row(right, "ゲージ技1", self.charge1_var, self.current_charge1)
        self.create_edit_row(right, "ゲージ技2", self.charge2_var, self.current_charge2)

        tk.Button(right, text="保存", width=20, command=self.save_pokemon).pack(pady=30)

    def create_edit_row(self, parent, label, variable, current_label):

        row = tk.Frame(parent)
        row.pack(pady=15, anchor="w")

        tk.Label(row, text=label, width=10).pack(side="left")

        combo = ttk.Combobox(row, textvariable=variable, width=28, height=8)
        combo.pack(side="left", padx=10)

        current_label.pack(in_=row, side="left", padx=15)

        if label == "通常技":
            self.fast_box = combo
        elif label == "ゲージ技1":
            self.charge1_box = combo
        else:
            self.charge2_box = combo

    def search_pokemon(self):

        word = self.poke_search.get()

        self.poke_listbox.delete(0, tk.END)

        for r in self.pokemon_data:
            if len(r) >= 2 and word in r[1]:
                self.poke_listbox.insert(tk.END, f"{r[0]}-{r[1]}")

    def select_pokemon(self, e):

        idx = self.poke_listbox.curselection()
        if not idx:
            return

        text = self.poke_listbox.get(idx)
        dex, name = text.split("-", 1)

        self.current_pokemon = (dex, name)
        self.target_name.config(text=f"{dex}-{name}")

        for r in self.pokemon_data:
            if r[0] == dex and r[1] == name:

                while len(r) < 7:
                    r.append("")

                self.current_fast.config(text=f"現在：{r[4]}")
                self.current_charge1.config(text=f"現在：{r[5]}")
                self.current_charge2.config(text=f"現在：{r[6]}")

                self.fast_var.set(r[4])
                self.charge1_var.set(r[5])
                self.charge2_var.set(r[6])

        if name in self.move_map:

            self.fast_box["values"] = self.move_map[name]["fast"]
            self.charge1_box["values"] = self.move_map[name]["charge"]
            self.charge2_box["values"] = self.move_map[name]["charge"]

    def save_pokemon(self):

        dex, name = self.current_pokemon

        for r in self.pokemon_data:
            if r[0] == dex and r[1] == name:

                while len(r) < 7:
                    r.append("")

                r[4] = self.fast_var.get()
                r[5] = self.charge1_var.get()
                r[6] = self.charge2_var.get()

                self.current_fast.config(text=f"現在：{r[4]}")
                self.current_charge1.config(text=f"現在：{r[5]}")
                self.current_charge2.config(text=f"現在：{r[6]}")

        save_csv(POKE_FILE, self.pokemon_data)
        shutil.copy(POKE_FILE, POKE_BACK)

        self.show_status("保存しました")

    # =========================
    # 技優先度タブ
    # =========================

    def build_move_tab(self):

        frame = self.tab_move

        left = tk.Frame(frame)
        right = tk.Frame(frame)

        left.pack(side="left", fill="y", padx=15, pady=15)
        right.pack(side="right", fill="both", expand=True, padx=30, pady=30)

        self.move_search = tk.Entry(left, width=25)
        self.move_search.pack(pady=5)

        self.move_search.bind("<KeyRelease>", lambda e: self.search_move())

        tk.Button(left, text="検索", command=self.search_move).pack(pady=5)

        self.move_listbox = tk.Listbox(left, width=30)
        self.move_listbox.pack(fill="y", expand=True, pady=10)

        self.move_listbox.bind("<<ListboxSelect>>", self.select_move)

        self.target_move = tk.Label(right, text="技:", font=("Arial", 16))
        self.target_move.pack(pady=20)

        self.priority_var = tk.StringVar()

        row = tk.Frame(right)
        row.pack(pady=20)

        self.priority_box = ttk.Combobox(
            row,
            textvariable=self.priority_var,
            values=["1", "2", "3", "4", "5"],
            width=20,
            height=8
        )
        self.priority_box.pack(side="left", padx=10)

        self.current_priority = tk.Label(row, text="現在：")
        self.current_priority.pack(side="left", padx=20)

        tk.Button(right, text="保存", width=20, command=self.save_move).pack(pady=30)

    def search_move(self):

        word = self.move_search.get()

        self.move_listbox.delete(0, tk.END)

        for r in self.move_data:
            if len(r) >= 2 and word in r[1]:
                self.move_listbox.insert(tk.END, r[1])

    def select_move(self, e):

        idx = self.move_listbox.curselection()
        if not idx:
            return

        name = self.move_listbox.get(idx)

        self.current_move = name
        self.target_move.config(text=name)

        for r in self.move_data:
            if r[1] == name:
                self.priority_var.set(r[3])
                self.current_priority.config(text=f"現在：{r[3]}")

    def save_move(self):

        for r in self.move_data:
            if r[1] == self.current_move:
                r[3] = self.priority_var.get()
                self.current_priority.config(text=f"現在：{r[3]}")

        save_csv(MOVE_FILE, self.move_data)
        shutil.copy(MOVE_FILE, MOVE_BACK)

        self.show_status("保存しました")

# =========================

restore_backup()

root = tk.Tk()
app = App(root)
root.mainloop()