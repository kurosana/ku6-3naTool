/**
 * チームシートツール - メインアプリ
 * 画面遷移・フォーム・プレビュー・localStorage・過去画像
 */

(function () {
  const STORAGE_KEYS = {
    handleName: "teamSheet_handleName",
    trainerName: "teamSheet_trainerName",
    friendCode: "teamSheet_friendCode",
    history: "teamSheet_history",
  };
  const MAX_HISTORY = 5;

  let state = {
    recognitionAttempted: false,
    handleName: "",
    trainerName: "",
    friendCode: "",
    pokemons: Array(6).fill(null).map(() => ({
      dexNo: null,
      name: null,
      cp: "",
      isShadow: false,
      isLight: false,
      fast: "",
      charge1: "",
      charge2: "",
    })),
  };

  const $ = (id) => document.getElementById(id);

  // ─── 進捗オーバーレイ共通ヘルパー ──────────────────────────────
  function showProgress() {
    const el = document.getElementById("overlay-progress");
    if (el) { el.classList.add("active"); el.setAttribute("aria-hidden", "false"); }
  }
  function hideProgress() {
    const el = document.getElementById("overlay-progress");
    if (el) { el.classList.remove("active"); el.setAttribute("aria-hidden", "true"); }
    const bar = document.getElementById("progress-overlay-bar");
    const txt = document.getElementById("progress-overlay-text");
    if (bar) bar.style.width = "0%";
    if (txt) txt.textContent = "0% 完了";
  }
  function setProgress(percent) {
    const p = Math.min(100, Math.max(0, Math.round(percent)));
    const bar = document.getElementById("progress-overlay-bar");
    const txt = document.getElementById("progress-overlay-text");
    if (bar) bar.style.width = p + "%";
    if (txt) txt.textContent = p + "% 完了";
  }
  // ───────────────────────────────────────────────────────────────

  const screens = {
    entrance: $("screen-entrance"),
    sheet: $("screen-sheet"),
    history: $("screen-history"),
  };
  let currentSearchSlotIndex = null;
  let searchTouchStartY = 0;
  let searchTouchStartX = 0;

  function showScreen(name) {
    Object.keys(screens).forEach((k) => {
      screens[k].classList.toggle("active", k === name);
    });
  }

  function loadSavedInputs() {
    try {
      state.handleName = localStorage.getItem(STORAGE_KEYS.handleName) || "";
      state.trainerName = localStorage.getItem(STORAGE_KEYS.trainerName) || "";
      state.friendCode = localStorage.getItem(STORAGE_KEYS.friendCode) || "";
    } catch (_) {}
  }

  function saveInputs() {
    try {
      localStorage.setItem(STORAGE_KEYS.handleName, state.handleName);
      localStorage.setItem(STORAGE_KEYS.trainerName, state.trainerName);
      localStorage.setItem(STORAGE_KEYS.friendCode, state.friendCode);
    } catch (_) {}
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.history);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(list.slice(0, MAX_HISTORY)));
    } catch (_) {}
  }

  function setPlaceholder(el, key) {
    const label = (typeof CONFIG !== "undefined" && CONFIG["label" + key]) || key;
    if (el) el.placeholder = label;
  }

  function initEntrance() {
    const explanation = $("entrance-explanation");
    if (explanation && typeof CONFIG !== "undefined" && CONFIG.imageLoadExplanation) {
      explanation.textContent = CONFIG.imageLoadExplanation;
    }

    $("btn-load-image").addEventListener("click", () => $("input-image").click());
    $("btn-start-without").addEventListener("click", () => openSheetWithRecognitionResult(null));
    $("btn-past").addEventListener("click", () => {
      renderHistory();
      showScreen("history");
    });

    $("input-image").addEventListener("change", async (e) => {
      const file = e.target && e.target.files[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      const img = new Image();
      img.onload = async () => {
        showProgress();
        const hint = document.getElementById("progress-overlay-hint");
        if (hint) { hint.setAttribute("aria-hidden", "false"); }
        try {
          const result = await Recognition.recognize(img, { onProgress: setProgress });
          openSheetWithRecognitionResult(result);
        } catch (err) {
          var failed = Array(6).fill(null).map(function () {
            return { dexNo: null, name: null, cp: null, isShadow: false, isLight: false };
          });
          openSheetWithRecognitionResult(failed);
        } finally {
          if (hint) { hint.setAttribute("aria-hidden", "true"); }
          hideProgress();
        }
      };
      img.onerror = () => openSheetWithRecognitionResult(null);
      img.src = URL.createObjectURL(file);
    });
  }

  function openSheetWithRecognitionResult(result) {
    loadSavedInputs();
    state.handleName = state.handleName || "";
    state.trainerName = state.trainerName || "";
    state.friendCode = state.friendCode || "";

    state.recognitionAttempted = result !== null && Array.isArray(result) && result.length >= 6;

    if (result && Array.isArray(result) && result.length >= 6) {
      result.forEach((r, i) => {
        const slot = state.pokemons[i];
        slot.dexNo = r.dexNo;
        slot.name = r.name || null;
        slot.cp = r.cp != null ? String(r.cp) : "";
        slot.isShadow = !!r.isShadow;
        slot.isLight = !!r.isLight;
        if (r.dexNo && DataService) {
          const p = DataService.getPokemonByDexNo(r.dexNo);
          if (p) {
            const def = DataService.getDefaultMoves(p);
            slot.fast = def.fast || "";
            slot.charge1 = def.charge1 || "";
            slot.charge2 = def.charge2 || "";
          }
        }
      });
    } else {
      state.pokemons = state.pokemons.map(() => ({
        dexNo: null,
        name: null,
        cp: "",
        isShadow: false,
        isLight: false,
        fast: "",
        charge1: "",
        charge2: "",
      }));
    }

    bindSheetForm();
    renderPokemonSlots();
    showScreen("sheet");
  }

  function bindSheetForm() {
    const handle = $("input-handle");
    const trainer = $("input-trainer");
    const friend = $("input-friendcode");
    if (handle) {
      handle.value = state.handleName;
      handle.placeholder = (typeof CONFIG !== "undefined" && CONFIG.labelHandleName) || "ハンドルネーム";
      handle.oninput = () => { state.handleName = handle.value; };
    }
    if (trainer) {
      trainer.value = state.trainerName;
      trainer.placeholder = (typeof CONFIG !== "undefined" && CONFIG.labelTrainerName) || "トレーナーネーム";
      trainer.oninput = () => { state.trainerName = trainer.value; };
    }
    if (friend) {
      friend.value = state.friendCode;
      friend.placeholder = (typeof CONFIG !== "undefined" && CONFIG.labelFriendCode) || "フレンドコード";
      friend.oninput = () => {
        friend.value = friend.value.replace(/\D/g, "");
        state.friendCode = friend.value;
      };
    }

    $("btn-back-sheet").onclick = () => showScreen("entrance");
    $("btn-output").onclick = outputImage;
    $("btn-preview").onclick = openPreviewOverlay;
  }

  function renderPokemonSlots() {
    const container = $("pokemon-slots");
    if (!container) return;
    const labelSelect = (typeof CONFIG !== "undefined" && CONFIG.labelSelectPokemon) || "ポケモン選択";
    const labelFailed = (typeof CONFIG !== "undefined" && CONFIG.labelRecognitionFailed) || "画像認識失敗";
    const labelCp = (typeof CONFIG !== "undefined" && CONFIG.labelCp) || "CP";
    const basePath = (typeof getBasePath === "function" && getBasePath()) || "./";
    const shadowLightPath = basePath.replace(/\/?$/, "/") + "Image/Type&shadow/";

    container.innerHTML = state.pokemons.map((p, i) => {
      const nameLabel = p.name || (p.dexNo === null ? (state.recognitionAttempted ? labelFailed : labelSelect) : labelFailed);
      var showQuestionMark = state.recognitionAttempted && !p.dexNo;
      const picSrc = p.dexNo && DataService ? (() => {
        const pm = DataService.getPokemonByDexNo(p.dexNo);
        return (pm && pm.picPath) ? basePath.replace(/\/?$/, "/") + pm.picPath : "";
      })() : "";
      const picOrPlaceholder = p.dexNo
        ? (picSrc ? `<img class="slot-pokemon-img" src="${picSrc}" alt="" onerror="this.style.display='none'">` : `<img class="slot-pokemon-img" src="${basePath}Image/Pic/Question_Mark.png" alt="">`)
        : (showQuestionMark ? `<img class="slot-pokemon-img" src="${basePath}Image/Pic/Question_Mark.png" alt="">` : "");
      const moves = DataService && p.dexNo ? DataService.getMovesForPokemon(p.dexNo) : { fast: [], charge: [] };
      const fastOpts = (moves.fast || []).map((m) => `<option value="${escapeHtml(m)}" ${m === p.fast ? "selected" : ""}>${escapeHtml(m)}</option>`).join("");
      const chargeList = moves.charge || [];
      const charge1Opts = chargeList.map((m) => `<option value="${escapeHtml(m)}" ${m === p.charge1 ? "selected" : ""}>${escapeHtml(m)}</option>`).join("");
      const charge2Opts = chargeList.map((m) => `<option value="${escapeHtml(m)}" ${m === p.charge2 ? "selected" : ""}>${escapeHtml(m)}</option>`).join("");

      return `
        <div class="pokemon-slot" data-slot="${i}">
          <div class="slot-name-wrap">
            <div class="slot-pokemon-name slot-name-btn ${!p.name ? "placeholder" : ""}" data-slot="${i}" data-field="name">${escapeHtml(nameLabel)}</div>
          </div>
          ${picOrPlaceholder}
          <div class="slot-cp">${labelCp}: <input type="text" inputmode="numeric" pattern="[0-9]*" data-slot="${i}" data-field="cp" value="${escapeHtml(p.cp)}" ${!p.dexNo ? "disabled" : ""}></div>
          <div class="slot-shadow-light">
            <button type="button" class="shadow-light-btn ${p.isShadow ? "pressed" : ""}" data-slot="${i}" data-btn="shadow" title="シャドウ"><img src="${shadowLightPath}shadow.png" alt="シャドウ"></button>
            <button type="button" class="shadow-light-btn ${p.isLight ? "pressed" : ""}" data-slot="${i}" data-btn="light" title="ライト"><img src="${shadowLightPath}light.png" alt="ライト"></button>
          </div>
          <div class="slot-moves">
            <div class="move-row"><span class="move-type-icon" data-slot="${i}" data-move="fast"></span><div class="move-select-wrap"><select data-slot="${i}" data-field="fast" ${!p.dexNo ? "disabled" : ""}><option value="">--</option>${fastOpts}</select><span class="move-display" aria-hidden="true">${escapeHtml(p.fast && DataService ? DataService.getDisplayMoveName(p.fast) : "")}</span></div></div>
            <div class="move-row"><span class="move-type-icon" data-slot="${i}" data-move="charge1"></span><div class="move-select-wrap"><select data-slot="${i}" data-field="charge1" ${!p.dexNo ? "disabled" : ""}><option value="">--</option>${charge1Opts}</select><span class="move-display" aria-hidden="true">${escapeHtml(p.charge1 && DataService ? DataService.getDisplayMoveName(p.charge1) : "")}</span></div></div>
            <div class="move-row"><span class="move-type-icon" data-slot="${i}" data-move="charge2"></span><div class="move-select-wrap"><select data-slot="${i}" data-field="charge2" ${!p.dexNo ? "disabled" : ""}><option value="">--</option>${charge2Opts}</select><span class="move-display" aria-hidden="true">${escapeHtml(p.charge2 && DataService ? DataService.getDisplayMoveName(p.charge2) : "")}</span></div></div>
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll("[data-slot]").forEach((el) => {
      const slotIndex = parseInt(el.getAttribute("data-slot"), 10);
      const field = el.getAttribute("data-field");
      const btn = el.getAttribute("data-btn");
      const move = el.getAttribute("data-move");

      if (field === "name") {
        el.addEventListener("click", () => openSearchOverlay(slotIndex));
        el.addEventListener("touchstart", (e) => { searchTouchStartY = e.touches[0].clientY; }, { passive: true });
        el.addEventListener("touchend", (e) => {
          const dy = Math.abs(e.changedTouches[0].clientY - searchTouchStartY);
          if (dy < 10) openSearchOverlay(slotIndex);
        }, { passive: true });
      } else if (field === "cp") {
        el.addEventListener("input", () => {
          el.value = el.value.replace(/\D/g, "");
          state.pokemons[slotIndex].cp = el.value;
        });
      } else if (field === "fast" || field === "charge1" || field === "charge2") {
        el.addEventListener("change", () => {
          const key = field === "fast" ? "fast" : field === "charge1" ? "charge1" : "charge2";
          state.pokemons[slotIndex][key] = el.value;
          updateTypeIcon(slotIndex, key, el.value);
          // 折り畳み表示スパンを短縮名で更新
          const disp = el.parentElement && el.parentElement.querySelector(".move-display");
          if (disp) disp.textContent = el.value && DataService ? DataService.getDisplayMoveName(el.value) : "";
        });
        if (el.value) updateTypeIcon(slotIndex, field, el.value);
      }

      if (btn === "shadow" || btn === "light") {
        el.addEventListener("click", () => {
          const slot = state.pokemons[slotIndex];
          if (btn === "shadow") {
            slot.isShadow = !slot.isShadow;
            if (slot.isShadow) slot.isLight = false;
          } else {
            slot.isLight = !slot.isLight;
            if (slot.isLight) slot.isShadow = false;
          }
          renderPokemonSlots();
        });
      }
    });
  }

  async function openPreviewOverlay() {
    const overlay = $("overlay-preview");
    const container = $("preview-overlay-content");
    if (!overlay || !container) return;
    let canvas = container.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      container.appendChild(canvas);
    }
    const maxW = Math.min(400, window.innerWidth - 32);
    const w = maxW;
    const h = Math.floor((w * 2480) / 1748);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    await document.fonts.ready;
    showProgress();
    try {
      await SheetRender.drawSheet(state, canvas, true, setProgress);
    } finally {
      hideProgress();
    }
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closePreviewOverlay() {
    const overlay = $("overlay-preview");
    if (overlay) {
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
    }
  }

  function updateTypeIcon(slotIndex, moveKey, moveName) {
    if (!DataService || !moveName) return;
    const typeName = DataService.getMoveTypeName(moveName);
    const path = typeName && DataService.getTypeIconPath(typeName);
    const basePath = (typeof getBasePath === "function" && getBasePath()) || "./";
    const icon = document.querySelector(`.slot-moves .move-type-icon[data-slot="${slotIndex}"][data-move="${moveKey}"]`);
    if (icon) {
      icon.innerHTML = path ? `<img src="${basePath.replace(/\/?$/, "/") + path}" alt="" width="18" height="18">` : "";
    }
  }

  function openSearchOverlay(slotIndex) {
    currentSearchSlotIndex = slotIndex;
    const overlay = $("overlay-search");
    const results = $("search-results");
    const searchInput = $("search-pokemon");
    if (overlay) overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    function runSearch(q) {
      const filtered = DataService.searchPokemon(q);
      const basePath = (typeof getBasePath === "function" && getBasePath()) || "./";
      results.innerHTML = filtered.map((p) => `
        <div class="search-result-item" data-dex="${escapeHtml(p.dexNo)}" data-name="${escapeHtml(p.name)}">
          <img src="${basePath.replace(/\/?$/, "/") + (p.picPath || "Image/Pic/" + p.dexNo + ".png")}" alt="">
          <span>${escapeHtml(p.name)}</span>
        </div>`).join("");
      results.querySelectorAll(".search-result-item").forEach((item) => {
        const dex = item.getAttribute("data-dex");
        const name = item.getAttribute("data-name");
        item.addEventListener("click", (e) => {
          e.preventDefault();
          selectPokemon(dex, name);
        });
        item.addEventListener("touchstart", function (e) {
          searchTouchStartX = e.touches[0].clientX;
          searchTouchStartY = e.touches[0].clientY;
        }, { passive: true });
        item.addEventListener("touchend", function (e) {
          var dx = e.changedTouches[0].clientX - searchTouchStartX;
          var dy = e.changedTouches[0].clientY - searchTouchStartY;
          if (dx * dx + dy * dy < 225) {
            e.preventDefault();
            selectPokemon(dex, name);
          }
        }, { passive: false });
      });
    }
    if (searchInput) searchInput.oninput = () => runSearch(searchInput.value);
    runSearch("");
  }

  function selectPokemon(dexNo, name) {
    if (currentSearchSlotIndex == null || !DataService) return;
    const p = DataService.getPokemonByDexNo(dexNo);
    const def = p ? DataService.getDefaultMoves(p) : { fast: "", charge1: "", charge2: "" };
    const slot = state.pokemons[currentSearchSlotIndex];
    slot.dexNo = dexNo;
    slot.name = name;
    slot.fast = def.fast || "";
    slot.charge1 = def.charge1 || "";
    slot.charge2 = def.charge2 || "";
    if (!slot.cp && slot.cp !== 0) slot.cp = "";
    renderPokemonSlots();
    currentSearchSlotIndex = null;
    closeSearchOverlay();
  }

  function closeSearchOverlay() {
    const overlay = $("overlay-search");
    if (overlay) overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    currentSearchSlotIndex = null;
  }

  $("btn-close-search").addEventListener("click", closeSearchOverlay);
  $("search-pokemon").addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearchOverlay();
  });

  var btnClosePreview = document.getElementById("btn-close-preview");
  var overlayPreview = document.getElementById("overlay-preview");
  if (btnClosePreview) btnClosePreview.addEventListener("click", closePreviewOverlay);
  if (overlayPreview) overlayPreview.addEventListener("click", function (e) {
    if (e.target.classList.contains("preview-overlay-backdrop") || e.target.id === "overlay-preview") closePreviewOverlay();
  });

  window.showRecognitionDebug = function (image, results, debugData, layout) {
    var overlay = document.getElementById("overlay-debug-recognition");
    var canvasFull = document.getElementById("debug-canvas-full");
    var cellsContainer = document.getElementById("debug-cells");
    if (!overlay || !canvasFull || !cellsContainer) return;
    var w = layout.w;
    var h = layout.h;
    var maxW = 380;
    var maxH = 520;
    var scale = Math.min(maxW / w, maxH / h, 1);
    var cw = Math.round(w * scale);
    var ch = Math.round(h * scale);
    canvasFull.width = cw;
    canvasFull.height = ch;
    canvasFull.style.width = cw + "px";
    canvasFull.style.height = ch + "px";
    var ctx = canvasFull.getContext("2d");
    ctx.drawImage(image, 0, 0, w, h, 0, 0, cw, ch);
    var zones = layout.zones;
    if (zones) {
      [zones.cp1, zones.cp2].forEach(function (arr) { if (arr) arr.forEach(function (r) { ctx.strokeStyle = "rgba(0,100,255,0.9)"; ctx.lineWidth = 1.5; ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale); }); });
      [zones.pokemon1, zones.pokemon2].forEach(function (arr) { if (arr) arr.forEach(function (r) { ctx.strokeStyle = "rgba(255,0,0,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale); }); });
    }
    debugData.forEach(function (d) {
      if (d.pokemonRect) {
        ctx.strokeStyle = "rgba(255,200,0,0.95)";
        ctx.lineWidth = 2;
        ctx.strokeRect(d.pokemonRect.x * scale, d.pokemonRect.y * scale, d.pokemonRect.w * scale, d.pokemonRect.h * scale);
      }
      if (d.cpRect) {
        ctx.strokeStyle = "rgba(0,255,200,0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(d.cpRect.x * scale, d.cpRect.y * scale, d.cpRect.w * scale, d.cpRect.h * scale);
      }
    });
    cellsContainer.innerHTML = "";
    var threshold = (typeof CONFIG !== "undefined" && CONFIG.imageMatchThreshold) ? CONFIG.imageMatchThreshold : 0.65;
    debugData.forEach(function (d) {
      var pr = d.pokemonRect || {};
      var div = document.createElement("div");
      div.className = "debug-cell-item";
      var row = document.createElement("div");
      row.className = "debug-cell-thumbnails";
      var smallP = document.createElement("canvas");
      smallP.width = 64;
      smallP.height = 64;
      smallP.className = "debug-cell-canvas";
      smallP.title = "ポケモン切り取り";
      var sctx = smallP.getContext("2d");
      if (pr.w && pr.h) sctx.drawImage(image, pr.x, pr.y, pr.w, pr.h, 0, 0, 64, 64);
      sctx.strokeStyle = "red";
      sctx.strokeRect(0, 0, 64, 64);
      row.appendChild(smallP);
      var cr = d.cpRect || {};
      var smallC = document.createElement("canvas");
      smallC.width = 48;
      smallC.height = 32;
      smallC.className = "debug-cell-canvas debug-cell-cp";
      smallC.title = "CP切り取り";
      var cctx = smallC.getContext("2d");
      if (cr.w && cr.h) cctx.drawImage(image, cr.x, cr.y, cr.w, cr.h, 0, 0, 48, 32);
      cctx.strokeStyle = "blue";
      cctx.strokeRect(0, 0, 48, 32);
      row.appendChild(smallC);
      div.appendChild(row);
      var name = (d.match && d.match.name) ? d.match.name : "未認識";
      var scoreText = "ポケモン " + (d.bestScore != null ? d.bestScore.toFixed(3) : "-");
      var belowThreshold = (d.bestScore != null && d.bestScore < threshold) ? " (閾値" + threshold + "未満)" : "";
      var cpText = d.cp != null ? "CP " + d.cp : "CP ---";
      var cpScoreText = (d.cpScore != null) ? " 一致度 " + d.cpScore.toFixed(3) : "";
      var slText = (d.isShadow ? " [シャドウ]" : "") + (d.isLight ? " [ライト]" : "");
      var p = document.createElement("p");
      p.className = "debug-cell-info";
      p.textContent = "スロット" + (d.index + 1) + ": " + name + slText + " " + scoreText + belowThreshold;
      div.appendChild(p);
      var p2 = document.createElement("p");
      p2.className = "debug-cell-info debug-cell-cp-sl";
      p2.textContent = cpText + cpScoreText;
      div.appendChild(p2);
      cellsContainer.appendChild(div);
    });
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  };

  document.getElementById("btn-close-debug").addEventListener("click", function () {
    var overlay = document.getElementById("overlay-debug-recognition");
    if (overlay) {
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
    }
  });
  document.getElementById("overlay-debug-recognition").addEventListener("click", function (e) {
    if (e.target.classList.contains("debug-overlay-backdrop")) {
      document.getElementById("overlay-debug-recognition").classList.remove("active");
      document.getElementById("overlay-debug-recognition").setAttribute("aria-hidden", "true");
    }
  });

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  async function outputImage() {
    saveInputs();
    showProgress();
    try {
      await document.fonts.ready;
      const blob = await SheetRender.renderToBlob(state, setProgress);
      const url = URL.createObjectURL(blob);

      // ダウンロードリンクで保存（スマホ含む全環境対応）
      const a = document.createElement("a");
      a.href = url;
      a.download = "teamsheet.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // PCでは新規タブでも表示（スマホでは無視される or ブロックされるため無害）
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (!isMobile) {
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(`<html><head><title>チームシート</title></head><body style="margin:0;background:#eee;"><img src="${url}" alt="チームシート" style="max-width:100%;height:auto;"></body></html>`);
          win.document.close();
        }
      }

      const list = loadHistory();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      list.unshift({ dataUrl, at: Date.now() });
      saveHistory(list);
    } catch (_) {
    } finally {
      hideProgress();
    }
  }

  function renderHistory() {
    const list = loadHistory();
    const container = $("history-list");
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<p class="history-empty">保存された画像はありません</p>';
      return;
    }
    container.innerHTML = list.map((item, i) => `
      <div class="history-item">
        <img src="${item.dataUrl}" alt="過去のシート ${i + 1}">
        <div class="history-meta">${new Date(item.at).toLocaleString("ja-JP")}</div>
      </div>`).join("");
  }

  $("btn-back-history").addEventListener("click", () => showScreen("entrance"));

  async function boot() {
    try {
      await DataService.loadAll();
    } catch (e) {
      console.error(e);
    }
    initEntrance();
    showScreen("entrance");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
