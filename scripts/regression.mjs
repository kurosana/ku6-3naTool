/**
 * ローカル回帰テスト（Puppeteer + 静的HTTP）
 * 実行: node scripts/regression.mjs
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8767;

const EDGE_PATHS = [
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

function mime(p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
      rel = rel.split("/").join(path.sep);
      const file = path.resolve(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mime(file) });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function nodeCsvChecks() {
  const failures = [];
  const moveCsv = fs.readFileSync(path.join(ROOT, "Data/move_list.csv"), "utf8");
  const rows = moveCsv.replace(/\uFEFF/g, "").trim().split(/\r?\n/).filter(Boolean);
  const ids = [];
  rows.forEach((line, i) => {
    const cols = line.split(",");
    if (cols.length < 5) failures.push(`move_list.csv 行${i + 1}: 5列未満`);
    const id = parseInt(cols[4], 10);
    if (!id || id < 1 || id > 1023) failures.push(`move_list.csv 行${i + 1}: printId 不正 (${cols[4]})`);
    ids.push(id);
  });
  const uniq = new Set(ids);
  if (uniq.size !== ids.length) failures.push("move_list.csv: printId 重複あり");
  const movelist = fs.readFileSync(path.join(ROOT, "Data/poke_movelist.csv"), "utf8");
  const thirdPlusInCharge = [];
  movelist.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const [kind, dex, , ...moves] = line.split(",");
    if (kind !== "1") return;
    moves.forEach((m) => {
      const n = m.replace(/＋/g, "+").trim();
      if (/\+$/.test(n) && !n.startsWith("せいなるほのお") && !n.startsWith("エアロブラスト")) {
        thirdPlusInCharge.push(`${dex}:${n}`);
      }
    });
  });
  if (thirdPlusInCharge.length) {
    failures.push(`poke_movelist kind=1 に+技: ${thirdPlusInCharge.slice(0, 5).join(", ")}${thirdPlusInCharge.length > 5 ? "..." : ""}`);
  }
  return { moveRows: rows.length, failures };
}

function extractQrHelpersFromAppJs() {
  const appJs = fs.readFileSync(path.join(ROOT, "js/app.js"), "utf8");
  const emptyStart = appJs.indexOf("function emptyPokemons()");
  const emptyEnd = appJs.indexOf("function showScreen(", emptyStart);
  const qrStart = appJs.indexOf("function bytesToBase32(");
  const qrEnd = appJs.indexOf("function stopQrReadCamera(");
  if (emptyStart < 0 || qrStart < 0 || qrEnd < 0) throw new Error("app.js QR 抽出失敗");
  return appJs.slice(emptyStart, emptyEnd) + "\n" + appJs.slice(qrStart, qrEnd);
}

async function main() {
  const results = [];
  const push = (name, ok, detail = "") => results.push({ name, ok, detail });

  const csv = nodeCsvChecks();
  push("CSV move_list 5列・printId", csv.failures.length === 0, csv.failures.join("; ") || `${csv.moveRows}行`);
  push("CSV +技がkind=1にない", csv.failures.every((f) => !f.includes("kind=1")), csv.failures.find((f) => f.includes("kind=1")) || "OK");

  const qrHelperSrc = extractQrHelpersFromAppJs();
  const server = await startServer();
  const edgePath = EDGE_PATHS.find((p) => fs.existsSync(p));
  if (!edgePath) {
    server.close();
    throw new Error("Microsoft Edge が見つかりません");
  }

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });

  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("[pageerror]", e.message));
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => typeof DataService !== "undefined" && typeof CONFIG !== "undefined", { timeout: 60000 });

    const browserTests = await page.evaluate(async (qrSrc) => {
      const out = [];
      const assert = (name, cond, detail = "") => out.push({ name, ok: !!cond, detail });

      try {
        await DataService.loadAll();
      } catch (e) {
        assert("DataService.loadAll", false, String(e));
        return out;
      }
      assert("DataService.loadAll", true);

      const v = CONFIG && CONFIG.appVersion;
      assert("CONFIG.appVersion", v === "v3.1.15", v || "missing");

      const cram = DataService.getMovesForPokemon("845");
      const seal = DataService.getMovesForPokemon("364");
      const hasPlus = (arr) => (arr || []).some((m) => /\+$/.test(String(m).replace(/＋/g, "+")));
      assert("ウッウ chargeになみのり+なし", !hasPlus(cram.charge));
      assert("トドグラー chargeになみのり+なし", !hasPlus(seal.charge));
      assert("なみのり+ printId", DataService.getMovePrintId("なみのり+") === 242);
      assert("Surf+ トークン解決", DataService.parseJsonMoveName("Surf+", "658-1") === "なみのり+");

      const mega = DataService.getPokemonByDexNo("658-1");
      const megaThird = DataService.getMovesForPokemon("658-1").third;
      assert("メガゲッコウガ thirdになみのり+", megaThird.includes("なみのり+"));

      assert("qrcode ライブラリ", typeof qrcode === "function");
      assert("SheetRender", typeof SheetRender !== "undefined" && typeof SheetRender.drawSheet === "function");
      assert("jsQR", typeof jsQR === "function");

      assert("DOM 主要画面", !!document.getElementById("screen-top") && !!document.getElementById("screen-sheet"));
      assert("DOM 印刷QR", !!document.getElementById("overlay-qr-debug") && !!document.getElementById("btn-output-qr") && !document.getElementById("btn-qr-debug"));
      assert("DOM QR読み取りガイド", !!document.getElementById("qr-read-shade") && !!document.getElementById("qr-read-guide") && !document.getElementById("btn-qr-diag"));
      assert("DOM スロットピッカー用クラスCSS", !!document.querySelector('link[href*="style.css"]'));

      // QR codec（app.js から抽出した同一実装）
      // eslint-disable-next-line no-eval
      eval(qrSrc);

      const sampleJson = {
        trainerName: "テストトレーナー",
        trainerId: "ハンドル名",
        friendCode: "1234-5678-9012",
        pokemons: [
          {
            dex: "658-1",
            CP: 4200,
            shadow: false,
            light: false,
            fastMoves: ["Water_Shuriken"],
            chargedMoves1: ["Hydro_Pump"],
            chargedMoves2: ["Dark_Pulse"],
            thirdMoves: ["Surf+"],
          },
          { dex: "845", CP: 1500, shadow: true, light: false, fastMoves: ["Peck"], chargedMoves1: ["Surf"], chargedMoves2: ["Fly"], thirdMoves: [] },
        ],
      };

      const payload = partyJsonToPrintText(sampleJson);
      assert("QR binary payload 先頭バイト", payload.length > 20);
      const decoded = printTextToSheetState(payload);
      assert("QR binary 往復 decode", !!decoded);
      assert("QR ハンドル名", decoded && decoded.handleName === sampleJson.trainerName);
      assert("QR トレーナー名", decoded && decoded.trainerName === sampleJson.trainerId);
      assert("QR フレンドコード", decoded && decoded.friendCode === "123456789012");
      assert("QR 1匹目 CP", decoded && decoded.pokemons[0] && decoded.pokemons[0].cp === "4200");
      assert("QR 1匹目 third", decoded && decoded.pokemons[0] && decoded.pokemons[0].third === "なみのり+");
      assert("QR 2匹目 shadow", decoded && decoded.pokemons[1] && decoded.pokemons[1].isShadow === true);

      if (typeof qrcode === "function" && payload) {
        const qr = qrcode(0, "Q");
        qr.addData(payload, "Alphanumeric");
        qr.make();
        const ver = (qr.getModuleCount() - 17) / 4;
        assert("QR 生成 Version<=12", ver <= 12, `version=${ver}, len=${payload.length}`);
      }

      const legacyJson = JSON.stringify({
        n: "旧形式",
        t: "トレーナー",
        f: "999988887777",
        p: [["25", 2000, 0, 0, "Thunder_Shock", "Wild_Charge", "", ""]],
      });
      const legacyBytes = new TextEncoder().encode(legacyJson);
      const legacyPayload = bytesToBase32(legacyBytes);
      const legacyDecoded = printTextToSheetState(legacyPayload);
      assert("QR legacy JSON decode", legacyDecoded && legacyDecoded.handleName === "旧形式");
      assert("QR legacy ピカチュウ", legacyDecoded && legacyDecoded.pokemons[0] && legacyDecoded.pokemons[0].name === "ピカチュウ");

      const canvas = document.createElement("canvas");
      canvas.width = 1748;
      canvas.height = 2480;
      const sheetState = {
        handleName: "回帰",
        trainerName: "テスト",
        friendCode: "111122223333",
        engOutput: false,
        pokemons: [
          {
            dexNo: "658-1",
            name: mega ? mega.name : "メガゲッコウガ",
            cp: "4000",
            isShadow: false,
            isLight: false,
            fast: "みずしゅりけん",
            charge1: "ハイドロポンプ",
            charge2: "かみなりパンチ",
            third: "なみのり+",
          },
          ...Array(5).fill(null).map(() => ({
            dexNo: null,
            name: null,
            cp: "",
            isShadow: false,
            isLight: false,
            fast: "",
            charge1: "",
            charge2: "",
            third: "",
          })),
        ],
      };
      try {
        await SheetRender.drawSheet(sheetState, canvas, false);
        const px = canvas.getContext("2d").getImageData(100, 100, 1, 1).data;
        assert("シート canvas 描画", canvas.width === 1748 && canvas.height === 2480 && (px[3] > 0 || px[0] + px[1] + px[2] > 0), `${canvas.width}x${canvas.height}`);
      } catch (e) {
        assert("シート canvas 描画", false, String(e));
      }

      const cropHit = await (async () => {
        const payload = "ABCDEFGH234567";
        const qr = qrcode(0, "M");
        qr.addData(payload, "Alphanumeric");
        qr.make();
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("qr image"));
          el.src = qr.createDataURL(4, 4);
        });
        const W = 1920;
        const H = 1080;
        const scene = document.createElement("canvas");
        scene.width = W;
        scene.height = H;
        const sctx = scene.getContext("2d");
        sctx.fillStyle = "#777";
        sctx.fillRect(0, 0, W, H);
        const qw = 150;
        sctx.drawImage(img, (W - qw) / 2, (H - qw) / 2, qw, qw);
        const scan = (sx, sy, sw, sh, dw, dh) => {
          const c = document.createElement("canvas");
          c.width = dw;
          c.height = dh;
          const x = c.getContext("2d", { willReadFrequently: true });
          x.drawImage(scene, sx, sy, sw, sh, 0, 0, dw, dh);
          const image = x.getImageData(0, 0, dw, dh);
          const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          return code && code.data ? code.data : "";
        };
        const side = Math.round(Math.min(W, H) * 0.72);
        const center = scan((W - side) / 2, (H - side) / 2, side, side, Math.min(side, 960), Math.min(side, 960));
        const scale = 960 / W;
        const full = scan(0, 0, W, H, Math.round(W * scale), Math.round(H * scale));
        return { center: center === payload, full: full === payload };
      })();
      assert("中央切り出しで小さいQRを読める", cropHit.center, cropHit.full ? "全体縮小でも読めた" : "全体縮小では読めず");

      return out;
    }, qrHelperSrc);

    await page.click("#btn-to-version");
    await page.waitForSelector("#screen-version.active");
    await page.click("#btn-qr-read");
    await page.waitForSelector("#screen-qr-read.active");
    await page.waitForFunction(() => {
      const t = document.getElementById("qr-read-live") && document.getElementById("qr-read-live").textContent;
      return t && t !== "カメラを起動しています";
    }, { timeout: 8000 }).catch(() => {});
    const cam = await page.evaluate(() => {
      const live = document.getElementById("qr-read-live");
      const note = document.querySelector("#qr-read-camera .qr-read-note");
      return {
        note: note ? note.textContent : "",
        live: live ? live.textContent : "",
        guide: !!document.getElementById("qr-read-guide"),
      };
    });
    push("QR読み取り画面の案内", cam.note.indexOf("白い枠") >= 0, cam.note);
    push("QR読み取りの状態表示", !!cam.live, cam.live);

    await page.setViewport({ width: 1400, height: 800 });
    const wide = await page.evaluate(async () => {
      const overlay = document.getElementById("overlay-output");
      const box = overlay.querySelector(".preview-overlay-box");
      const content = document.getElementById("output-overlay-content");
      content.innerHTML = "";
      const img = new Image();
      img.alt = "sheet";
      img.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1748" height="2480"><rect width="1748" height="2480" fill="#ddd"/></svg>');
      content.appendChild(img);
      overlay.classList.add("active");
      await img.decode();
      const r = box.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      const qrBtn = document.getElementById("btn-output-qr");
      const qr = qrBtn.getBoundingClientRect();
      const noteEl = overlay.querySelector(".preview-overlay-note");
      const note = noteEl.getBoundingClientRect();
      const textRight = note.right - parseFloat(getComputedStyle(noteEl).paddingRight);
      const actions = overlay.querySelector(".output-actions").getBoundingClientRect();
      document.getElementById("btn-output-qr").click();
      const qrOverlay = document.getElementById("overlay-qr-debug");
      const qrImg = qrOverlay.querySelector(".qr-debug-image-wrap img");
      const video = document.getElementById("qr-read-video");
      const readNote = document.querySelector("#qr-read-camera .qr-read-note");
      const shade = document.getElementById("qr-read-shade");
      return {
        boxBottom: r.bottom,
        actionsBottom: actions.bottom,
        imgH: ir.height,
        imgW: ir.width,
        qrOnCorner: qr.top <= r.top + 16 && qr.right >= r.right - 16 && qr.left > r.left + r.width * 0.55,
        textClear: textRight <= qr.left + 1,
        vh: window.innerHeight,
        qrOpen: qrOverlay.classList.contains("active") && !!(qrImg && qrImg.src),
        videoW: video.getBoundingClientRect().width,
        videoH: video.getBoundingClientRect().height,
        stageW: video.parentElement.getBoundingClientRect().width,
        aspectOk: !video.videoWidth || Math.abs((video.getBoundingClientRect().width / video.getBoundingClientRect().height) - (video.videoWidth / video.videoHeight)) < 0.15,
        readNoteBottom: readNote.getBoundingClientRect().bottom,
        shadeOverflow: getComputedStyle(shade).overflow,
        cameraHidden: (function () {
          const camera = document.getElementById("qr-read-camera");
          const result = document.getElementById("qr-read-result");
          camera.hidden = true;
          result.hidden = false;
          const display = getComputedStyle(camera).display;
          const h = camera.getBoundingClientRect().height;
          camera.hidden = false;
          result.hidden = true;
          return display === "none" && h === 0;
        })(),
      };
    });
    push("PCで出力ポップアップが画面内", wide.boxBottom <= wide.vh + 1 && wide.actionsBottom <= wide.vh + 1, `bottom ${Math.round(wide.actionsBottom)} / ${wide.vh}, image ${Math.round(wide.imgW)}x${Math.round(wide.imgH)}`);
    push("出力QRボタンが右上", wide.qrOnCorner && wide.textClear);
    push("表示中パーティのQR", wide.qrOpen);
    push("PCの読み取りプレビュー", wide.stageW >= 900 && wide.videoH >= 400 && wide.aspectOk && wide.readNoteBottom <= wide.vh + 1, `stage ${Math.round(wide.stageW)} video ${Math.round(wide.videoW)}x${Math.round(wide.videoH)} note ${Math.round(wide.readNoteBottom)}/${wide.vh}`);
    push("読み取り後にカメラが残らない", wide.cameraHidden);
    push("枠のグレーはカメラ内", wide.shadeOverflow === "hidden", wide.shadeOverflow);

    await page.setViewport({ width: 390, height: 844 });
    const phone = await page.evaluate(() => {
      const img = document.querySelector("#output-overlay-content img");
      return img ? getComputedStyle(img).maxHeight : "";
    });
    push("スマホの出力画像は従来の高さ", phone === "none", phone);

    await page.setViewport({ width: 1400, height: 800 });
    const confirmWide = await page.evaluate(async () => {
      const camera = document.getElementById("qr-read-camera");
      const result = document.getElementById("qr-read-result");
      const img = document.getElementById("qr-read-image");
      img.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1748" height="2480"><rect width="1748" height="2480" fill="#ddd"/></svg>');
      camera.hidden = true;
      result.hidden = false;
      try { await img.decode(); } catch (_) {}
      const lead = document.querySelector(".qr-read-confirm-lead");
      const ir = img.getBoundingClientRect();
      const lr = lead.getBoundingClientRect();
      const zone = img.parentElement.getBoundingClientRect();
      const resultBox = result.getBoundingClientRect();
      const confirm = document.querySelector(".qr-read-confirm").getBoundingClientRect();
      const btns = [...document.querySelectorAll(".qr-read-confirm-actions button")].map((b) => b.getBoundingClientRect());
      const leadStyle = getComputedStyle(lead);
      const mid = (r) => (r.left + r.right) / 2;
      const midY = (r) => (r.top + r.bottom) / 2;
      return {
        cols: getComputedStyle(result).gridTemplateColumns,
        centered: Math.abs(mid(ir) - mid(zone)) < 12 && Math.abs(midY(ir) - midY(zone)) < 12,
        imgFills: ir.height > zone.height * 0.75 && ir.width > 200,
        zoneRatio: zone.width / resultBox.width,
        leadAfterImage: lr.left >= ir.right - 2,
        leadCentered: Math.abs(midY(lr) - midY(confirm)) < confirm.height * 0.28,
        fieldCentered: Math.abs(mid(lr) - (ir.right + window.innerWidth) / 2) < 14 && Math.abs(((btns[0].left + btns[1].right) / 2) - (ir.right + window.innerWidth) / 2) < 14,
        oneLine: leadStyle.whiteSpace === "nowrap" && lead.scrollWidth <= lead.clientWidth + 1,
        sideBySide: btns.length === 2 && btns[1].left >= btns[0].right - 1 && Math.abs(btns[0].top - btns[1].top) < 6,
        lead: lead.textContent,
        cancel: document.getElementById("btn-qr-print-cancel").className,
        print: document.getElementById("btn-qr-print").className,
      };
    });
    push("横長はシートの右に確認", confirmWide.cols.split(" ").length === 2 && confirmWide.centered && confirmWide.imgFills && confirmWide.zoneRatio > 0.55 && confirmWide.zoneRatio < 0.65 && confirmWide.leadAfterImage && confirmWide.leadCentered && confirmWide.fieldCentered && confirmWide.sideBySide && confirmWide.oneLine, confirmWide.cols);
    push("印刷確認の文言とボタン", confirmWide.lead.indexOf("確認してください") >= 0 && confirmWide.cancel.indexOf("btn-secondary") >= 0 && confirmWide.print.indexOf("btn-primary") >= 0);

    await page.setViewport({ width: 390, height: 844 });
    const confirmPhone = await page.evaluate(() => {
      const result = document.getElementById("qr-read-result");
      const img = document.getElementById("qr-read-image").getBoundingClientRect();
      const zone = document.querySelector(".qr-read-sheet-zone").getBoundingClientRect();
      const lead = document.querySelector(".qr-read-confirm-lead").getBoundingClientRect();
      const btns = [...document.querySelectorAll(".qr-read-confirm-actions button")].map((b) => b.getBoundingClientRect());
      const mid = (r) => (r.left + r.right) / 2;
      return {
        rows: getComputedStyle(result).gridTemplateRows,
        leadBelow: lead.top >= img.bottom - 2,
        centered: Math.abs(mid(img) - mid(zone)) < 12,
        sideBySide: btns.length === 2 && btns[1].left >= btns[0].right - 1 && Math.abs(btns[0].top - btns[1].top) < 6,
      };
    });
    push("縦画面は確認を下に並べる", confirmPhone.leadBelow && confirmPhone.centered && confirmPhone.sideBySide, confirmPhone.rows);

    await page.setViewport({ width: 1400, height: 800 });
    const backFromSheet = await page.evaluate(() => {
      document.getElementById("qr-read-camera").hidden = true;
      document.getElementById("qr-read-result").hidden = false;
      document.getElementById("btn-back-qr-read").click();
      return {
        camera: !document.getElementById("qr-read-camera").hidden,
        result: document.getElementById("qr-read-result").hidden,
        qr: document.getElementById("screen-qr-read").classList.contains("active"),
        version: document.getElementById("screen-version").classList.contains("active"),
      };
    });
    push("確認画面の戻るはカメラへ", backFromSheet.camera && backFromSheet.result && backFromSheet.qr && !backFromSheet.version, JSON.stringify(backFromSheet));

    const backToCamera = await page.evaluate(async () => {
      const output = document.getElementById("overlay-output");
      const qr = document.getElementById("overlay-qr-debug");
      if (output) output.classList.remove("active");
      if (qr) qr.classList.remove("active");
      const img = document.getElementById("qr-read-image");
      if (!img.getAttribute("src")) {
        img.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1748" height="2480"><rect width="1748" height="2480" fill="#ddd"/></svg>');
      }
      document.getElementById("qr-read-camera").hidden = true;
      document.getElementById("qr-read-result").hidden = false;
      let opened = false;
      window.open = () => { opened = true; return null; };
      const append = document.body.appendChild.bind(document.body);
      document.body.appendChild = function (node) {
        const added = append(node);
        if (node && node.tagName === "IFRAME") {
          const arm = () => {
            try {
              node.contentWindow.print = () => {
                fetch(node.src).then((res) => res.arrayBuffer()).then((buf) => {
                  const text = new TextDecoder("latin1").decode(new Uint8Array(buf));
                  window.__sheetPrint = {
                    pdf: text.startsWith("%PDF"),
                    pages: (text.match(/\/Type \/Page(?!s)/g) || []).length,
                    count: /\/Count 1/.test(text),
                    media: (text.match(/\/MediaBox \[0 0 ([0-9.]+) ([0-9.]+)\]/) || []).slice(1),
                  };
                  node.contentWindow.dispatchEvent(new Event("afterprint"));
                });
              };
            } catch (_) {}
          };
          arm();
          node.addEventListener("load", arm, true);
        }
        return added;
      };
      document.getElementById("btn-qr-print").click();
      const start = Date.now();
      while (!window.__sheetPrint && Date.now() - start < 20000) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      const startBack = Date.now();
      while (document.getElementById("qr-read-camera").hidden && Date.now() - startBack < 3000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const printed = window.__sheetPrint || {};
      return {
        camera: !document.getElementById("qr-read-camera").hidden,
        result: document.getElementById("qr-read-result").hidden,
        printing: document.body.classList.contains("sheet-print"),
        imageOnly: !opened && !!(printed.pdf && printed.pages === 1 && printed.count && printed.media[0] === "419.53" && printed.media[1] === "595.28"),
      };
    });
    push("印刷後に読み取りへ戻る", backToCamera.camera && backToCamera.result && !backToCamera.printing && backToCamera.imageOnly, JSON.stringify(backToCamera));

    browserTests.forEach((t) => push(t.name, t.ok, t.detail));
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== 回帰テスト結果 ===\n");
  results.forEach((r) => {
    console.log(`${r.ok ? "OK" : "FAIL"}  ${r.name}${r.detail ? " — " + r.detail : ""}`);
  });
  console.log(`\n合計: ${results.length} / 失敗: ${failed.length}\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
