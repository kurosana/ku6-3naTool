/**
 * 画像認識: アップロード画像を6枠に分割し、
 * Match/CPMatch テンプレートと比較してポケモン・CP を判定。
 * シャドウは (dexNo)_S.png、ライトは (dexNo)_L.png のテンプレートで識別。
 */

const Recognition = (function () {
  const BASE = (function () {
    try {
      return (typeof getBasePath === "function" ? getBasePath() : "") || "./";
    } catch (_) {
      return "./";
    }
  })();

  const THRESHOLD = () => (typeof CONFIG !== "undefined" ? CONFIG.imageMatchThreshold : 0.75);

  let matchTemplates = []; // { dexNo, name, isShadow, isLight, path, data, mask, w, h }
  let cpTemplates = []; // { cp, data }
  let searchTemplate = null; // { data, w, h } 「検索」サンプル
  let templatesLoaded = false;

  function pathJoin(base, p) {
    const b = base.replace(/\/?$/, "");
    const rest = (p || "").replace(/^\//, "");
    return rest ? b + "/" + rest : b;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Load failed: " + src));
      img.src = pathJoin(BASE, src);
    });
  }

  function imageToGrayData(img, w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) {
      out.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }
    return out;
  }

  /** グレーとマスクを返す。mask[i]=1 はテンプレートで「描画あり」（alpha>128）のピクセル。背景無視用 */
  function imageToGrayDataAndMask(img, w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const gray = [];
    const mask = [];
    for (let i = 0; i < d.length; i += 4) {
      gray.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      mask.push(d[i + 3] > 128 ? 1 : 0);
    }
    return { gray, mask };
  }

  /** _S / _L サフィックスと末尾#を除去してポケモン図鑑番号を返す */
  function normalizeDexFromFilename(filename) {
    const base = (filename || "").replace(/\.(png|jpg|jpeg)$/i, "").trim();
    return base.replace(/_[SL]$/i, "").replace(/#+$/, "");
  }

  /** ファイル名末尾が _S.png → シャドウ、_L.png → ライト */
  function getShadowLightFromFilename(filename) {
    const base = (filename || "").replace(/\.(png|jpg|jpeg)$/i, "").trim();
    if (/_S$/i.test(base)) return { isShadow: true, isLight: false };
    if (/_L$/i.test(base)) return { isShadow: false, isLight: true };
    return { isShadow: false, isLight: false };
  }

  function correlation(a, b) {
    if (a.length !== b.length || a.length === 0) return 0;
    const n = a.length;
    let sa = 0, sb = 0, sa2 = 0, sb2 = 0, sab = 0;
    for (let i = 0; i < n; i++) {
      sa += a[i];
      sb += b[i];
      sa2 += a[i] * a[i];
      sb2 += b[i] * b[i];
      sab += a[i] * b[i];
    }
    const na = n * sa2 - sa * sa;
    const nb = n * sb2 - sb * sb;
    if (na <= 0 || nb <= 0) return 0;
    return (n * sab - sa * sb) / Math.sqrt(na * nb);
  }

  /**
   * マスクが1のピクセルだけで相関を計算。
   * mask: テンプレートの透明部分マスク（1=有効）
   * mask2: スクリーンショット側の背景除外マスク（1=非背景）
   * 両方指定した場合は mask[i]=1 かつ mask2[i]=1 のピクセルのみ使用する
   */
  function maskedCorrelation(a, b, mask, mask2) {
    if (!mask && !mask2) return correlation(a, b);
    if (a.length !== b.length || a.length === 0) return 0;
    let n = 0, sa = 0, sb = 0, sa2 = 0, sb2 = 0, sab = 0;
    for (let i = 0; i < a.length; i++) {
      if (mask && !mask[i]) continue;
      if (mask2 && !mask2[i]) continue;
      n++;
      sa += a[i];
      sb += b[i];
      sa2 += a[i] * a[i];
      sb2 += b[i] * b[i];
      sab += a[i] * b[i];
    }
    if (n < 50) return 0;
    const na = n * sa2 - sa * sa;
    const nb = n * sb2 - sb * sb;
    if (na <= 0 || nb <= 0) return 0;
    return (n * sab - sa * sb) / Math.sqrt(na * nb);
  }

  /** ImageData からグレーと背景除外マスク（1=非背景）を同時に抽出 */
  function imageDataToGrayAndBgMask(imageData) {
    const d = imageData.data;
    const len = d.length >> 2;
    const gray = new Array(len);
    const bgMask = new Uint8Array(len);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      gray[j] = 0.299 * r + 0.587 * g + 0.114 * b;
      bgMask[j] = isBackgroundColor(r, g, b) ? 0 : 1;
    }
    return { gray, bgMask };
  }

  async function loadSearchTemplate() {
    const path = (typeof CONFIG !== "undefined" && CONFIG.recognitionSearchTemplatePath) ? CONFIG.recognitionSearchTemplatePath : "Image/Match/Searching.png";
    try {
      const img = await loadImage(pathJoin(BASE, path));
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const data = imageToGrayData(img, w, h);
      searchTemplate = { data, w, h };
    } catch (_) {
      searchTemplate = null;
    }
  }

  async function loadMatchTemplates(manifest) {
    const list = (manifest || "").split(/\n/).map((s) => s.trim()).filter(Boolean);
    const pokemonList = DataService.getPokemonList();
    const byPath = {};
    pokemonList.forEach((p) => {
      const key = (p.matchPath || "").split("/").pop();
      if (key && !byPath[key]) byPath[key] = p;
    });
    const loaded = [];
    const ignoreBg = (typeof CONFIG !== "undefined" && CONFIG.recognitionIgnoreBackground);
    for (const line of list) {
      const raw = (line || "").trim();
      // "Normal/71.png" や "Shadow/71_S.png" 形式、または旧来の "71.png" 形式に対応
      const entry = raw.includes(",") ? raw.replace(/^\s*\d+,\s*/, "").trim() : raw;
      if (!entry || !/\.png$/i.test(entry)) continue;

      // サブフォルダ（Normal / Shadow）を抽出
      const slashIdx = entry.indexOf("/");
      const subfolder = slashIdx >= 0 ? entry.slice(0, slashIdx) : "";
      const filename = slashIdx >= 0 ? entry.slice(slashIdx + 1) : entry;

      // シャドウ/ライト判定: フォルダ名 > ファイル名サフィックス の優先度
      let isShadow = false;
      let isLight = false;
      if (/^shadow$/i.test(subfolder)) {
        isShadow = true;
      } else if (/^light$/i.test(subfolder)) {
        isLight = true;
      } else {
        const sl = getShadowLightFromFilename(filename);
        isShadow = sl.isShadow;
        isLight = sl.isLight;
      }

      const base = filename.replace(/\.png$/i, "");
      const normalizedDex = normalizeDexFromFilename(filename);
      // パスを組み立て: サブフォルダがあれば "Image/Match/Normal/71.png" 形式、なければ旧来の形式
      const path = subfolder
        ? "Image/Match/" + subfolder + "/" + encodeURIComponent(filename)
        : "Image/Match/" + encodeURIComponent(filename);
      try {
        const img = await loadImage(path);
        const tw = img.naturalWidth || img.width;
        const th = img.naturalHeight || img.height;
        let data, mask;
        if (ignoreBg) {
          const gm = imageToGrayDataAndMask(img, tw, th);
          data = gm.gray;
          mask = gm.mask;
        } else {
          data = imageToGrayData(img, tw, th);
          mask = null;
        }
        const pokemon = byPath[filename] || DataService.getPokemonByDexNo(normalizedDex) || DataService.getPokemonByDexNo(base);
        loaded.push({
          dexNo: (pokemon && pokemon.dexNo) || normalizedDex,
          name: (pokemon && pokemon.name) || normalizedDex,
          isShadow,
          isLight,
          path,
          data,
          mask,
          w: tw,
          h: th,
        });
      } catch (_) {
        /* skip */
      }
    }
    matchTemplates = loaded;
  }

  async function loadCPTemplates() {
    const size = 24;
    const loaded = [];
    for (let cp = 1500; cp >= 1480; cp--) {
      try {
        const img = await loadImage("Image/CPMatch/" + cp + ".png");
        loaded.push({ cp, data: imageToGrayData(img, size, size) });
      } catch (_) {
        /* skip */
      }
    }
    cpTemplates = loaded;
  }

  async function ensureTemplates() {
    if (templatesLoaded) return;
    let manifestText = "";
    let usedFallback = false;
    try {
      const base = BASE.replace(/\/?$/, "/");
      const res = await fetch(base + "Data/match_manifest.txt");
      if (res.ok) manifestText = await res.text();
    } catch (_) {}
    if (!manifestText.trim()) {
      usedFallback = true;
      const list = DataService.getPokemonList();
      const paths = list.slice(0, 350).map((p) => (p.matchPath || "").split("/").pop()).filter(Boolean);
      manifestText = [...new Set(paths)].join("\n");
    }
    await Promise.all([
      loadSearchTemplate(),
      loadMatchTemplates(manifestText),
      loadCPTemplates(),
    ]);
    templatesLoaded = true;
    if (typeof console !== "undefined" && console.log) {
      const shadowCount = matchTemplates.filter((t) => t.isShadow).length;
      const lightCount = matchTemplates.filter((t) => t.isLight).length;
      console.log("[画像認識] テンプレート読込: Match " + matchTemplates.length + " 件 (シャドウ " + shadowCount + " 件, ライト " + lightCount + " 件), CP " + cpTemplates.length + " 件" + (usedFallback ? " (manifestはCSVから生成)" : " (match_manifest.txt使用)"));
      if (matchTemplates.length === 0) console.warn("[画像認識] Matchが0件です。Data/match_manifest.txt または Image/Match/*.png のパス・存在を確認してください。");
    }
  }

  function cropAndResize(img, x, y, w, h, outW, outH) {
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, x, y, w, h, 0, 0, outW, outH);
    return ctx.getImageData(0, 0, outW, outH);
  }

  function imageDataToGray(data) {
    const d = data.data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) {
      out.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }
    return out;
  }

  function getGraySlice(imageData, fullW, fullH, x0, y0, sliceW, sliceH) {
    const d = imageData.data;
    const out = [];
    for (let j = 0; j < sliceH; j++) {
      for (let i = 0; i < sliceW; i++) {
        const x = x0 + i;
        const y = y0 + j;
        if (x < 0 || x >= fullW || y < 0 || y >= fullH) { out.push(128); continue; }
        const idx = (y * fullW + x) * 4;
        out.push(0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]);
      }
    }
    return out;
  }

  function detectPokemonInCell(cellData32) {
    if (!matchTemplates.length) return { match: null, bestScore: 0 };
    let best = null;
    let bestScore = -1;
    const gray = imageDataToGray(cellData32);
    const threshold = THRESHOLD();
    for (const t of matchTemplates) {
      let r;
      if (t.mask) {
        r = maskedCorrelation(gray, t.data, t.mask);
      } else {
        r = correlation(gray, t.data);
      }
      if (r > bestScore) {
        bestScore = r;
        best = r >= threshold ? { dexNo: t.dexNo, name: t.name } : null;
      }
    }
    if (best === null && bestScore > -1) best = null;
    return { match: best, bestScore: bestScore > -1 ? bestScore : 0 };
  }

  /** 指定矩形（ピクセル）をそのまま切り出してCPテンプレートと照合。一致度も返す（デバッグ用） */
  function detectCPInRegion(img, leftPx, topPx, widthPx, heightPx) {
    if (!cpTemplates.length) return { cp: null, score: 0 };
    const outSize = 24;
    const id = cropAndResize(img, leftPx, topPx, widthPx, heightPx, outSize, outSize);
    const gray = imageDataToGray(id);
    let best = null;
    let bestScore = 0.5;
    for (const t of cpTemplates) {
      const r = correlation(gray, t.data);
      if (r > bestScore) {
        bestScore = r;
        best = t.cp;
      }
    }
    return { cp: best, score: bestScore };
  }

  function parseHexColor(hex) {
    const m = (hex || "").replace(/^#/, "").match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [231, 244, 224];
  }

  function isBackgroundColor(r, g, b) {
    const bgMin = (typeof CONFIG !== "undefined" && CONFIG.recognitionBgGrayMin != null) ? CONFIG.recognitionBgGrayMin : 248;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (gray >= bgMin) return true;
    const hex = (typeof CONFIG !== "undefined" && CONFIG.recognitionSearchBarColor) ? CONFIG.recognitionSearchBarColor : "#e7f4e0";
    const [sr, sg, sb] = parseHexColor(hex);
    const tol = (typeof CONFIG !== "undefined" && CONFIG.recognitionSearchBarTolerance != null) ? CONFIG.recognitionSearchBarTolerance : 25;
    return Math.abs(r - sr) <= tol && Math.abs(g - sg) <= tol && Math.abs(b - sb) <= tol;
  }

  function detectSearchPosition(img) {
    if (!searchTemplate || !img) return null;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const sw = searchTemplate.w;
    const sh = searchTemplate.h;
    const searchLimitY = Math.floor(ih * 0.25);
    let bestScore = -1;
    let bestX = 0;
    let bestY = 0;
    const step = 3;
    const canvas = document.createElement("canvas");
    canvas.width = iw;
    canvas.height = ih;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, iw, ih);
    const imgGray = imageDataToGray(imgData);
    for (let y = 0; y <= searchLimitY - sh; y += step) {
      for (let x = 0; x <= iw - sw; x += step) {
        const slice = getGraySlice(imgData, iw, ih, x, y, sw, sh);
        const r = correlation(slice, searchTemplate.data);
        if (r > bestScore) { bestScore = r; bestX = x; bestY = y; }
      }
    }
    if (bestScore < 0.5) return null;
    return { x: bestX, y: bestY, w: sw, h: sh };
  }

  /** 検索欄の色(#e7f4e0)が終わる行を基準高さとする。searchTopY から下へ走査し、その行の多くが検索欄色でなくなった最初の行を返す */
  function findRefY(img, searchTopY) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const [sr, sg, sb] = parseHexColor((typeof CONFIG !== "undefined" && CONFIG.recognitionSearchBarColor) ? CONFIG.recognitionSearchBarColor : "#e7f4e0");
    const tol = (typeof CONFIG !== "undefined" && CONFIG.recognitionSearchBarTolerance != null) ? CONFIG.recognitionSearchBarTolerance : 25;
    const barColorRatio = 0.2;
    const startY = Math.max(0, Math.min(searchTopY, h - 1));
    for (let y = startY; y < h; y++) {
      let matchCount = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (Math.abs(r - sr) <= tol && Math.abs(g - sg) <= tol && Math.abs(b - sb) <= tol) matchCount++;
      }
      if (matchCount < w * barColorRatio) return y;
    }
    return startY;
  }

  function getZoneConfig() {
    const c = typeof CONFIG !== "undefined" ? CONFIG : {};
    const m = c.recognitionZoneM != null ? c.recognitionZoneM : 28;
    return {
      n: c.recognitionZoneN != null ? c.recognitionZoneN : 0,
      m: m,
      l: c.recognitionZoneL != null ? c.recognitionZoneL : 120,
      k: c.recognitionZoneK != null ? c.recognitionZoneK : 8,
      j: m,
      leftPct: c.recognitionContentLeftPct != null ? c.recognitionContentLeftPct : 0.06,
      widthPct: c.recognitionContentWidthPct != null ? c.recognitionContentWidthPct : 0.88,
    };
  }

  function computeZones(refY, imgW, imgH) {
    const z = getZoneConfig();
    const contentLeft = Math.round(imgW * z.leftPct);
    const contentWidth = Math.round(imgW * z.widthPct);
    const colW = Math.floor(contentWidth / 3);
    const cols = [
      { left: contentLeft, width: colW },
      { left: contentLeft + colW, width: colW },
      { left: contentLeft + colW * 2, width: contentWidth - colW * 2 },
    ];
    const cp1Top = refY + z.n;
    const cp1Bottom = cp1Top + z.m;
    const pk1Top = cp1Bottom;
    const pk1Bottom = pk1Top + z.l;
    const row2Start = pk1Bottom + z.k;
    const cp2Top = row2Start;
    const cp2Bottom = cp2Top + z.j;
    const pk2Top = cp2Bottom;
    const pk2Bottom = pk2Top + z.l;
    const cp1 = cols.map((c) => ({ x: c.left, y: cp1Top, w: c.width, h: z.m }));
    const pokemon1 = cols.map((c) => ({ x: c.left, y: pk1Top, w: c.width, h: z.l }));
    const cp2 = cols.map((c) => ({ x: c.left, y: cp2Top, w: c.width, h: z.j }));
    const pokemon2 = cols.map((c) => ({ x: c.left, y: pk2Top, w: c.width, h: z.l }));
    return { refY, contentLeft, contentWidth, cp1, pokemon1, cp2, pokemon2 };
  }

  /** 指定矩形内の背景でないピクセルを囲む最小矩形を返す */
  function findNonBackgroundBoundingBox(img, zoneX, zoneY, zoneW, zoneH) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(zoneX, zoneY, zoneW, zoneH);
    const d = id.data;
    let minX = zoneW, minY = zoneH, maxX = -1, maxY = -1;
    for (let j = 0; j < zoneH; j++) {
      for (let i = 0; i < zoneW; i++) {
        const idx = (j * zoneW + i) * 4;
        if (!isBackgroundColor(d[idx], d[idx + 1], d[idx + 2])) {
          if (i < minX) minX = i;
          if (j < minY) minY = j;
          if (i > maxX) maxX = i;
          if (j > maxY) maxY = j;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w < 8 || h < 8) return null;
    return { x: zoneX + minX, y: zoneY + minY, w, h };
  }

  function cropAndResizeTo(img, srcX, srcY, srcW, srcH, outW, outH) {
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
    return ctx.getImageData(0, 0, outW, outH);
  }

  function detectPokemonWithVariableTemplates(img, cropRect) {
    if (!matchTemplates.length || !cropRect) return { match: null, bestScore: 0, isShadow: false, isLight: false };
    let best = null;
    let bestScore = -1;
    let bestTemplate = null;
    const threshold = THRESHOLD();
    const ignoreBg = (typeof CONFIG !== "undefined" && CONFIG.recognitionIgnoreBackground);
    for (const t of matchTemplates) {
      const id = cropAndResizeTo(img, cropRect.x, cropRect.y, cropRect.w, cropRect.h, t.w, t.h);
      // スクリーンショット側の背景マスクをテンプレートリサイズ後に生成（背景色ピクセルを除外）
      let gray, bgMask;
      if (ignoreBg) {
        const gm = imageDataToGrayAndBgMask(id);
        gray = gm.gray;
        bgMask = gm.bgMask;
      } else {
        gray = imageDataToGray(id);
        bgMask = null;
      }
      // テンプレートマスク × 背景マスクの両方を適用して相関計算
      let r;
      if (t.mask || bgMask) r = maskedCorrelation(gray, t.data, t.mask || null, bgMask);
      else r = correlation(gray, t.data);
      if (r > bestScore) { bestScore = r; bestTemplate = t; best = r >= threshold ? { dexNo: t.dexNo, name: t.name } : null; }
    }
    const isShadow = !!(best && bestTemplate && bestTemplate.isShadow);
    const isLight = !!(best && bestTemplate && bestTemplate.isLight);
    return { match: best, bestScore: bestScore > -1 ? bestScore : 0, isShadow, isLight };
  }

  function detectCPInZone(img, zoneRect) {
    if (!cpTemplates.length || !zoneRect) return { cp: null, score: 0 };
    const bbox = findNonBackgroundBoundingBox(img, zoneRect.x, zoneRect.y, zoneRect.w, zoneRect.h);
    const rect = bbox || zoneRect;
    const outSize = 24;
    const id = cropAndResize(img, rect.x, rect.y, rect.w, rect.h, outSize, outSize);
    const gray = imageDataToGray(id);
    let best = null;
    let bestScore = 0.5;
    for (const t of cpTemplates) {
      const r = correlation(gray, t.data);
      if (r > bestScore) { bestScore = r; best = t.cp; }
    }
    return { cp: best, score: bestScore };
  }

  function yieldToUI() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  /**
   * 検索文字検出 → 基準高さ → ゾーン分割 → 各スロット認識 (ポケモン・CP・シャドウ/ライト)
   * options.onProgress(percent) で 0～100 の進捗を通知可能
   */
  async function recognizeZoneBased(image, options) {
    const onProgress = (options && typeof options.onProgress === "function") ? options.onProgress : function () {};
    onProgress(0);
    await ensureTemplates();
    onProgress(5);
    await yieldToUI();

    const w = image.naturalWidth || image.width;
    const h = image.naturalHeight || image.height;
    const debugMode = typeof CONFIG !== "undefined" && CONFIG.debugRecognition;

    let refY = Math.floor(h * 0.18);
    const searchPos = detectSearchPosition(image);
    if (searchPos) {
      const foundRef = findRefY(image, searchPos.y);
      if (foundRef != null) refY = foundRef;
    }

    const zones = computeZones(refY, w, h);
    const results = [];
    const debugData = [];
    const zoneRects = [];

    for (let slot = 0; slot < 6; slot++) {
      const col = slot % 3;
      const row = slot >= 3 ? 1 : 0;
      const pkZone = row === 0 ? zones.pokemon1[col] : zones.pokemon2[col];
      const cpZone = row === 0 ? zones.cp1[col] : zones.cp2[col];

      const pokemonBbox = findNonBackgroundBoundingBox(image, pkZone.x, pkZone.y, pkZone.w, pkZone.h);
      const pokemonResult = detectPokemonWithVariableTemplates(image, pokemonBbox);
      const cpResult = detectCPInZone(image, cpZone);
      const cpBbox = findNonBackgroundBoundingBox(image, cpZone.x, cpZone.y, cpZone.w, cpZone.h);

      results.push({
        dexNo: (pokemonResult.match && pokemonResult.match.dexNo) || null,
        name: (pokemonResult.match && pokemonResult.match.name) || null,
        cp: cpResult.cp,
        isShadow: pokemonResult.isShadow,
        isLight: pokemonResult.isLight,
      });
      if (debugMode) {
        zoneRects.push(cpZone, pkZone);
        debugData.push({
          index: slot,
          pokemonRect: pokemonBbox || pkZone,
          cpRect: cpBbox || cpZone,
          match: pokemonResult.match,
          bestScore: pokemonResult.bestScore,
          cp: cpResult.cp,
          cpScore: cpResult.score,
          isShadow: pokemonResult.isShadow,
          isLight: pokemonResult.isLight,
        });
      }
      onProgress(5 + Math.round((slot + 1) / 6 * 90));
      await yieldToUI();
    }

    if (typeof console !== "undefined" && console.log) {
      console.log("[画像認識] 認識完了:", results.map(function (r) { return r.name || "(未認識)"; }).join(", "));
    }
    if (debugMode && typeof window !== "undefined" && window.showRecognitionDebug) {
      window.showRecognitionDebug(image, results, debugData, { w, h, zones, zoneRects });
    }
    onProgress(100);
    return results;
  }

  /** 画像認識のエントリ。ゾーン基準で実行。options.onProgress(percent) で進捗通知可能 */
  async function recognize(image, options) {
    return recognizeZoneBased(image, options || {});
  }

  return { recognize, ensureTemplates };
})();
