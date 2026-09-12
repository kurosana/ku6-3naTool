/**
 * チームシートツール v3.0 - メインアプリ
 */

(function () {
  const ALL_MOVES_SENTINEL = "__ALL_MOVES__";

  const $ = (id) => document.getElementById(id);

  const screens = {
    top: $("screen-top"),
    menu: $("screen-menu"),
    sheet: $("screen-sheet"),
    scan: $("screen-scan"),
    slots: $("screen-slots"),
    logList: $("screen-log-list"),
    logEdit: $("screen-log-edit"),
    version: $("screen-version"),
  };

  let state = {
    recognitionAttempted: false,
    moveBugMode: false,
    handleName: "",
    trainerName: "",
    friendCode: "",
    engOutput: false,
    pokemons: emptyPokemons(),
  };

  let logState = {
    id: null,
    opponent: "",
    moveBugMode: false,
    pokemons: emptyPokemons(),
    dirty: false,
  };

  let activeSlotIndex = null;
  let sheetOrigin = "menu";
  let sheetDirty = false;
  let pendingSlotSaveIndex = null;
  let outputBlob = null;
  let outputBlobUrl = null;

  let currentSearchSlotIndex = null;
  let currentSearchContainerId = "pokemon-slots";
  let currentMoveSearchSlotIndex = null;
  let currentMoveSearchField = null;
  let currentMoveSearchContainerId = "pokemon-slots";
  let searchTouchStartY = 0;
  let searchTouchStartX = 0;
  let slotTouchStartX = 0;
  let slotTouchStartY = 0;

  let unsavedCallback = null;
  let nameEditSlotIndex = null;
  let recallField = null;

  function emptyPokemons() {
    return Array(6).fill(null).map(() => ({
      dexNo: null,
      name: null,
      cp: "",
      isShadow: false,
      isLight: false,
      fast: "",
      charge1: "",
      charge2: "",
      third: "",
    }));
  }

  function showScreen(name) {
    Object.keys(screens).forEach((k) => {
      if (screens[k]) screens[k].classList.toggle("active", k === name);
    });
    const active = screens[name];
    if (active) {
      const enter = active.querySelector(".screen-enter");
      if (enter) {
        enter.classList.remove("screen-enter");
        void enter.offsetWidth;
        enter.classList.add("screen-enter");
      }
    }
    if (name === "top" && window.AnimService) {
      window.AnimService.initRevealObserver();
    }
  }

  function showProgress() {
    const el = $("overlay-progress");
    if (el) { el.classList.add("active"); el.setAttribute("aria-hidden", "false"); }
  }
  function hideProgress() {
    const el = $("overlay-progress");
    if (el) { el.classList.remove("active"); el.setAttribute("aria-hidden", "true"); }
    const bar = $("progress-overlay-bar");
    const txt = $("progress-overlay-text");
    if (bar) bar.style.width = "0%";
    if (txt) txt.textContent = "0% 完了";
  }
  function setProgress(percent) {
    const p = Math.min(100, Math.max(0, Math.round(percent)));
    const bar = $("progress-overlay-bar");
    const txt = $("progress-overlay-text");
    if (bar) bar.style.width = p + "%";
    if (txt) txt.textContent = p + "% 完了";
  }
  function waitForPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }
  function beginRecognitionProgress() {
    showProgress();
    setProgress(0);
    const hint = $("progress-overlay-hint");
    if (hint) {
      hint.textContent = (CONFIG && CONFIG.labelRecognitionHint) || "";
      hint.setAttribute("aria-hidden", hint.textContent ? "false" : "true");
    }
    const hint2 = $("progress-overlay-hint2");
    if (hint2) {
      const t2 = (CONFIG && CONFIG.labelRecognitionHint2) || "";
      hint2.textContent = t2;
      hint2.setAttribute("aria-hidden", t2 ? "false" : "true");
    }
  }
  function endRecognitionProgress() {
    const hint = $("progress-overlay-hint");
    const hint2 = $("progress-overlay-hint2");
    if (hint) hint.setAttribute("aria-hidden", "true");
    if (hint2) hint2.setAttribute("aria-hidden", "true");
    hideProgress();
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function loadSavedInputs() {
    state.engOutput = StorageService.getEngOutput();
  }
  function saveEngOutput() {
    StorageService.setEngOutput(state.engOutput);
  }

  function bindTouchSelect(el, onSelect) {
    el.addEventListener("click", (e) => { e.preventDefault(); onSelect(); });
    el.addEventListener("touchstart", (e) => {
      searchTouchStartX = e.touches[0].clientX;
      searchTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - searchTouchStartX;
      const dy = e.changedTouches[0].clientY - searchTouchStartY;
      if (dx * dx + dy * dy < 225) {
        e.preventDefault();
        onSelect();
      }
    }, { passive: false });
  }

  function bindSlotTouch(el, onTap) {
    el.addEventListener("click", onTap);
    el.addEventListener("touchstart", (e) => {
      slotTouchStartX = e.touches[0].clientX;
      slotTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - slotTouchStartX;
      const dy = e.changedTouches[0].clientY - slotTouchStartY;
      if (dx * dx + dy * dy < 225) {
        e.preventDefault();
        onTap();
      }
    }, { passive: false });
  }

  function buildMoveSelectOptions(learnList, selected, includeAllMovesOption) {
    const list = learnList || [];
    const seen = {};
    const parts = [];
    if (selected && list.indexOf(selected) < 0) {
      parts.push(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`);
      seen[selected] = true;
    }
    list.forEach((m) => {
      if (!m || seen[m]) return;
      seen[m] = true;
      parts.push(`<option value="${escapeHtml(m)}" ${m === selected ? "selected" : ""}>${escapeHtml(m)}</option>`);
    });
    if (includeAllMovesOption) {
      parts.push(`<option value="${ALL_MOVES_SENTINEL}">全わざリストから選択</option>`);
    }
    return parts.join("");
  }

  function getSlotState(containerId) {
    return containerId === "log-pokemon-slots" ? logState : state;
  }

  function renderPokemonSlots(containerId) {
    const container = $(containerId || "pokemon-slots");
    if (!container) return;
    const slotState = getSlotState(containerId);
    const pokemons = slotState.pokemons;
    const moveBug = slotState.moveBugMode;
    const recAttempted = containerId === "pokemon-slots" ? state.recognitionAttempted : false;

    const labelSelect = (CONFIG && CONFIG.labelSelectPokemon) || "ポケモン選択";
    const labelFailed = (CONFIG && CONFIG.labelRecognitionFailed) || "画像認識失敗";
    const labelCp = (CONFIG && CONFIG.labelCp) || "CP";
    const basePath = getBasePath();
    const shadowLightPath = basePath.replace(/\/?$/, "/") + "Image/Type&shadow/";

    container.innerHTML = pokemons.map((p, i) => {
      const nameLabel = p.name || (p.dexNo === null ? (recAttempted ? labelFailed : labelSelect) : labelFailed);
      const pm = p.dexNo && DataService ? DataService.getPokemonByDexNo(p.dexNo) : null;
      const isMega = !!(pm && DataService.isMegaPokemon(pm));
      const picSrc = pm && pm.picPath ? basePath.replace(/\/?$/, "/") + pm.picPath : "";
      const picOrPlaceholder = p.dexNo
        ? (picSrc ? `<img class="slot-pokemon-img slot-pokemon-img--clickable" src="${picSrc}" alt="" data-slot="${i}" data-field="img" onerror="this.style.display='none'">` : `<img class="slot-pokemon-img slot-pokemon-img--clickable" src="${basePath}Image/Pic/Question_Mark.png" alt="" data-slot="${i}" data-field="img">`)
        : `<img class="slot-pokemon-img slot-pokemon-img--clickable" src="${basePath}Image/Pic/Question_Mark.png" alt="" data-slot="${i}" data-field="img">`;
      const moves = DataService && p.dexNo ? DataService.getMovesForPokemon(p.dexNo) : { fast: [], charge: [], third: [] };
      if (DataService) {
        if (DataService.isThirdAttackName(p.charge1)) p.charge1 = "";
        if (DataService.isThirdAttackName(p.charge2)) p.charge2 = "";
      }
      const showAllMovesOpt = !!(moveBug && p.dexNo);
      const fastOpts = buildMoveSelectOptions(moves.fast, p.fast, showAllMovesOpt);
      const charge1Opts = buildMoveSelectOptions(moves.charge, p.charge1, showAllMovesOpt);
      const charge2Opts = buildMoveSelectOptions(moves.charge, p.charge2, showAllMovesOpt);
      const megaBg = isMega ? `<img class="slot-mega-bg" src="${shadowLightPath}mega_trans.png" alt="" aria-hidden="true">` : "";
      if (isMega) p.third = (moves.third && moves.third[0]) || "";
      else p.third = "";
      const thirdLabel = p.third && DataService ? DataService.getDisplayMoveName(p.third) : "-";
      const thirdRow = isMega ? `<div class="move-row"><span class="move-type-icon" data-slot="${i}" data-move="third"></span><div class="move-select-wrap"><span class="move-fixed-display">${escapeHtml(thirdLabel)}</span></div></div>` : "";
      const movesBlock = `
          <div class="slot-moves">
            <div class="move-row"><span class="move-type-icon" data-slot="${i}" data-move="fast"></span><div class="move-select-wrap"><select data-slot="${i}" data-field="fast" ${!p.dexNo ? "disabled" : ""}><option value="">--</option>${fastOpts}</select><span class="move-display" aria-hidden="true">${escapeHtml(p.fast && DataService ? DataService.getDisplayMoveName(p.fast) : "")}</span></div></div>
            <div class="move-row"><span class="move-type-icon" data-slot="${i}" data-move="charge1"></span><div class="move-select-wrap"><select data-slot="${i}" data-field="charge1" ${!p.dexNo ? "disabled" : ""}><option value="">--</option>${charge1Opts}</select><span class="move-display" aria-hidden="true">${escapeHtml(p.charge1 && DataService ? DataService.getDisplayMoveName(p.charge1) : "")}</span></div></div>
            <div class="move-row"><span class="move-type-icon" data-slot="${i}" data-move="charge2"></span><div class="move-select-wrap"><select data-slot="${i}" data-field="charge2" ${!p.dexNo ? "disabled" : ""}><option value="">--</option>${charge2Opts}</select><span class="move-display" aria-hidden="true">${escapeHtml(p.charge2 && DataService ? DataService.getDisplayMoveName(p.charge2) : "")}</span></div></div>${thirdRow}
          </div>`;

      return `
        <div class="pokemon-slot${isMega ? " slot-mega" : ""}" data-slot="${i}">
          ${megaBg}
          <div class="slot-name-wrap">
            <div class="slot-pokemon-name slot-name-btn ${!p.name ? "placeholder" : ""}" data-slot="${i}" data-field="name">${escapeHtml(nameLabel)}</div>
          </div>
          ${picOrPlaceholder}
          <div class="slot-cp">${labelCp}: <input type="text" inputmode="numeric" pattern="[0-9]*" data-slot="${i}" data-field="cp" value="${escapeHtml(p.cp)}" ${!p.dexNo ? "disabled" : ""}></div>
          <div class="slot-shadow-light">
            <button type="button" class="shadow-light-btn ${p.isShadow ? "pressed" : ""}" data-slot="${i}" data-btn="shadow" title="シャドウ"><img src="${shadowLightPath}shadow.png" alt="シャドウ"></button>
            <button type="button" class="shadow-light-btn ${p.isLight ? "pressed" : ""}" data-slot="${i}" data-btn="light" title="ライト"><img src="${shadowLightPath}light.png" alt="ライト"></button>
          </div>${movesBlock}
        </div>`;
    }).join("");

    container.querySelectorAll("[data-slot]").forEach((el) => {
      const slotIndex = parseInt(el.getAttribute("data-slot"), 10);
      const field = el.getAttribute("data-field");
      const btn = el.getAttribute("data-btn");
      if (field === "name" || field === "img") {
        bindTouchSelect(el, () => openSearchOverlay(slotIndex, containerId));
      } else if (field === "cp") {
        el.addEventListener("input", () => {
          el.value = el.value.replace(/\D/g, "");
          pokemons[slotIndex].cp = el.value;
          if (containerId === "log-pokemon-slots") logState.dirty = true;
          else sheetDirty = true;
        });
      } else if (field === "fast" || field === "charge1" || field === "charge2") {
        el.addEventListener("change", () => {
          const key = field;
          if (el.value === ALL_MOVES_SENTINEL) {
            el.value = pokemons[slotIndex][key] || "";
            openMoveSearchOverlay(slotIndex, key, containerId);
            return;
          }
          pokemons[slotIndex][key] = el.value;
          updateTypeIcon(slotIndex, key, el.value, containerId);
          const disp = el.parentElement && el.parentElement.querySelector(".move-display");
          if (disp) disp.textContent = el.value && DataService ? DataService.getDisplayMoveName(el.value) : "";
          if (containerId === "log-pokemon-slots") logState.dirty = true;
          else sheetDirty = true;
        });
        if (el.value) updateTypeIcon(slotIndex, field, el.value, containerId);
      }
      if (btn === "shadow" || btn === "light") {
        el.addEventListener("click", () => {
          const slot = pokemons[slotIndex];
          if (btn === "shadow") {
            slot.isShadow = !slot.isShadow;
            if (slot.isShadow) slot.isLight = false;
          } else {
            slot.isLight = !slot.isLight;
            if (slot.isLight) slot.isShadow = false;
          }
          if (containerId === "log-pokemon-slots") logState.dirty = true;
          else sheetDirty = true;
          renderPokemonSlots(containerId);
        });
      }
    });
    pokemons.forEach((p, i) => {
      if (p.third) updateTypeIcon(i, "third", p.third, containerId);
    });
  }

  function updateTypeIcon(slotIndex, moveKey, moveName, containerId) {
    if (!DataService || !moveName) return;
    const typeName = DataService.getMoveTypeName(moveName);
    const path = typeName && DataService.getTypeIconPath(typeName);
    const basePath = getBasePath();
    const root = $(containerId || "pokemon-slots");
    if (!root) return;
    const icon = root.querySelector(`.slot-moves .move-type-icon[data-slot="${slotIndex}"][data-move="${moveKey}"]`);
    if (icon) {
      icon.innerHTML = path ? `<img src="${basePath.replace(/\/?$/, "/") + path}" alt="" width="18" height="18">` : "";
    }
  }

  function collectPriorityDex() {
    const dexes = [];
    const pushFrom = (json) => {
      if (!json || !Array.isArray(json.pokemons)) return;
      json.pokemons.forEach((p) => {
        if (p && p.dex != null) dexes.push(p.dex);
      });
    };
    StorageService.getPartySlots().forEach((s) => { if (s) pushFrom(s.json); });
    StorageService.getBattleLogs().forEach((log) => pushFrom(log.json));
    if (DataService && DataService.setSearchPriority) DataService.setSearchPriority(dexes);
  }

  function openSearchOverlay(slotIndex, containerId) {
    currentSearchSlotIndex = slotIndex;
    currentSearchContainerId = containerId || "pokemon-slots";
    collectPriorityDex();
    const overlay = $("overlay-search");
    const results = $("search-results");
    const searchInput = $("search-pokemon");
    if (overlay) { overlay.classList.add("active"); overlay.setAttribute("aria-hidden", "false"); }
    if (searchInput) { searchInput.value = ""; searchInput.focus(); }

    function runSearch(q) {
      const filtered = DataService.searchPokemon(q);
      const basePath = getBasePath();
      results.innerHTML = filtered.map((p) => `
        <div class="search-result-item" data-dex="${escapeHtml(p.dexNo)}" data-name="${escapeHtml(p.name)}">
          <img src="${basePath.replace(/\/?$/, "/") + (p.picPath || "Image/Pic/" + p.dexNo + ".png")}" alt="">
          <span>${escapeHtml(p.name)}</span>
        </div>`).join("");
      results.querySelectorAll(".search-result-item").forEach((item) => {
        const dex = item.getAttribute("data-dex");
        const name = item.getAttribute("data-name");
        bindTouchSelect(item, () => selectPokemon(dex, name));
      });
    }
    if (searchInput) searchInput.oninput = () => runSearch(searchInput.value);
    runSearch("");
  }

  function selectPokemon(dexNo, name) {
    if (currentSearchSlotIndex == null || !DataService) return;
    const slotState = getSlotState(currentSearchContainerId);
    const p = DataService.getPokemonByDexNo(dexNo);
    const def = p ? DataService.getDefaultMoves(p) : { fast: "", charge1: "", charge2: "" };
    const slot = slotState.pokemons[currentSearchSlotIndex];
    slot.dexNo = dexNo;
    slot.name = name;
    slot.fast = def.fast || "";
    slot.charge1 = def.charge1 || "";
    slot.charge2 = def.charge2 || "";
    slot.third = def.third || "";
    if (!slot.cp) slot.cp = "";
    if (currentSearchContainerId === "log-pokemon-slots") logState.dirty = true;
    else sheetDirty = true;
    renderPokemonSlots(currentSearchContainerId);
    closeSearchOverlay();
  }

  function closeSearchOverlay() {
    const overlay = $("overlay-search");
    if (overlay) { overlay.classList.remove("active"); overlay.setAttribute("aria-hidden", "true"); }
    currentSearchSlotIndex = null;
  }

  function openMoveSearchOverlay(slotIndex, field, containerId) {
    currentMoveSearchSlotIndex = slotIndex;
    currentMoveSearchField = field;
    currentMoveSearchContainerId = containerId || "pokemon-slots";
    const overlay = $("overlay-move-search");
    const results = $("move-search-results");
    const searchInput = $("search-move");
    if (!overlay || !results || !DataService) return;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    if (searchInput) { searchInput.value = ""; searchInput.focus(); }
    const kind = field === "fast" ? 0 : field === "third" ? 2 : 1;
    function runMoveSearch(q) {
      const filtered = DataService.searchMoves(q, kind);
      const basePath = getBasePath();
      results.innerHTML = filtered.map((m) => {
        const typeName = m.type || "";
        const iconPath = typeName ? DataService.getTypeIconPath(typeName) : "";
        const imgHtml = iconPath ? `<img src="${basePath.replace(/\/?$/, "/") + iconPath}" alt="">` : `<span class="search-result-icon-placeholder"></span>`;
        return `<div class="search-result-item" data-move="${escapeHtml(m.name)}">${imgHtml}<span>${escapeHtml(m.name)}</span></div>`;
      }).join("");
      results.querySelectorAll(".search-result-item").forEach((item) => {
        const moveName = item.getAttribute("data-move");
        bindTouchSelect(item, () => selectMoveFromAllList(moveName));
      });
    }
    if (searchInput) searchInput.oninput = () => runMoveSearch(searchInput.value);
    runMoveSearch("");
  }

  function selectMoveFromAllList(moveName) {
    if (currentMoveSearchSlotIndex == null || !currentMoveSearchField) return;
    const slotState = getSlotState(currentMoveSearchContainerId);
    const slot = slotState.pokemons[currentMoveSearchSlotIndex];
    if (!slot) return;
    slot[currentMoveSearchField] = moveName || "";
    if (currentMoveSearchContainerId === "log-pokemon-slots") logState.dirty = true;
    else sheetDirty = true;
    renderPokemonSlots(currentMoveSearchContainerId);
    closeMoveSearchOverlay();
  }

  function closeMoveSearchOverlay() {
    const overlay = $("overlay-move-search");
    if (overlay) { overlay.classList.remove("active"); overlay.setAttribute("aria-hidden", "true"); }
    currentMoveSearchSlotIndex = null;
    currentMoveSearchField = null;
  }

  function buildPartyJson(curState) {
    const pokemons = curState.pokemons.map((p) => {
      if (!p || !p.dexNo) return null;
      const pm = DataService ? DataService.getPokemonByDexNo(p.dexNo) : null;
      const speciesName = pm ? DataService.getPokemonEngName(pm.name) : "";
      const dexRaw = String(p.dexNo);
      const dex = /^\d+$/.test(dexRaw) ? Number(dexRaw) : dexRaw;
      const cpNum = parseInt(p.cp, 10);
      return {
        dex,
        speciesName,
        CP: Number.isFinite(cpNum) ? cpNum : null,
        shadow: !!p.isShadow,
        light: !!p.isLight,
        fastMoves: p.fast && DataService ? [DataService.formatMoveForJson(p.fast)].filter(Boolean) : [],
        chargedMoves1: p.charge1 && DataService ? [DataService.formatMoveForJson(p.charge1)].filter(Boolean) : [],
        chargedMoves2: p.charge2 && DataService ? [DataService.formatMoveForJson(p.charge2)].filter(Boolean) : [],
        thirdMoves: p.third && DataService ? [DataService.formatMoveForJson(p.third)].filter(Boolean) : [],
      };
    });
    return {
      trainerName: curState.handleName || "",
      trainerId: curState.trainerName || "",
      friendCode: curState.friendCode || "",
      pokemons,
    };
  }

  function buildLogJson() {
    const party = buildPartyJson({ handleName: "", trainerName: "", friendCode: "", pokemons: logState.pokemons });
    return { opponent: logState.opponent || "", pokemons: party.pokemons };
  }

  function isValidPartyJson(json) {
    return json && typeof json === "object" && Array.isArray(json.pokemons);
  }

  function applyPartyJson(json) {
    if (!isValidPartyJson(json)) return false;
    state.handleName = typeof json.trainerName === "string" ? json.trainerName : "";
    state.trainerName = typeof json.trainerId === "string" ? json.trainerId : "";
    state.friendCode = typeof json.friendCode === "string" ? String(json.friendCode).replace(/\D/g, "") : "";
    state.recognitionAttempted = false;
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const src = json.pokemons[i];
      const slot = emptyPokemons()[0];
      if (src && typeof src === "object") {
        let pm = null;
        if (src.dex != null) pm = DataService ? DataService.getPokemonByDexNo(String(src.dex)) : null;
        if (!pm && src.speciesName) pm = DataService ? DataService.getPokemonByEngName(src.speciesName) : null;
        if (pm) {
          slot.dexNo = pm.dexNo;
          slot.name = pm.name;
          if (src.CP != null && src.CP !== "") {
            const n = parseInt(src.CP, 10);
            if (Number.isFinite(n)) slot.cp = String(n);
          }
          slot.isShadow = !!src.shadow;
          slot.isLight = !!src.light;
          if (slot.isShadow && slot.isLight) slot.isLight = false;
          const pickToken = (v) => (Array.isArray(v) ? v[0] || "" : typeof v === "string" ? v : "");
          const def = DataService ? DataService.getDefaultMoves(pm) : { fast: "", charge1: "", charge2: "", third: "" };
          const fastJp = DataService ? DataService.parseJsonMoveName(pickToken(src.fastMoves), pm.dexNo) : "";
          const c1Jp = DataService ? DataService.parseJsonMoveName(pickToken(src.chargedMoves1), pm.dexNo) : "";
          const c2Jp = DataService ? DataService.parseJsonMoveName(pickToken(src.chargedMoves2), pm.dexNo) : "";
          const t3Jp = DataService ? DataService.parseJsonMoveName(pickToken(src.thirdMoves), pm.dexNo) : "";
          slot.fast = fastJp || def.fast || "";
          slot.charge1 = DataService.isThirdAttackName(c1Jp) ? (def.charge1 || "") : (c1Jp || def.charge1 || "");
          slot.charge2 = DataService.isThirdAttackName(c2Jp) ? (def.charge2 || "") : (c2Jp || def.charge2 || "");
          slot.third = t3Jp || def.third || "";
        }
      }
      slots.push(slot);
    }
    state.pokemons = slots;
    return true;
  }

  function applyLogJson(json) {
    logState.opponent = typeof json.opponent === "string" ? json.opponent : "";
    const fake = { trainerName: "", trainerId: "", friendCode: "", pokemons: json.pokemons || [] };
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const src = fake.pokemons[i];
      const slot = emptyPokemons()[0];
      if (src && typeof src === "object") {
        let pm = null;
        if (src.dex != null) pm = DataService ? DataService.getPokemonByDexNo(String(src.dex)) : null;
        if (!pm && src.speciesName) pm = DataService ? DataService.getPokemonByEngName(src.speciesName) : null;
        if (pm) {
          slot.dexNo = pm.dexNo;
          slot.name = pm.name;
          if (src.CP != null) {
            const n = parseInt(src.CP, 10);
            if (Number.isFinite(n)) slot.cp = String(n);
          }
          slot.isShadow = !!src.shadow;
          slot.isLight = !!src.light;
          const pickToken = (v) => (Array.isArray(v) ? v[0] || "" : typeof v === "string" ? v : "");
          const def = DataService.getDefaultMoves(pm);
          slot.fast = DataService.parseJsonMoveName(pickToken(src.fastMoves), pm.dexNo) || def.fast || "";
          const c1Jp = DataService.parseJsonMoveName(pickToken(src.chargedMoves1), pm.dexNo);
          const c2Jp = DataService.parseJsonMoveName(pickToken(src.chargedMoves2), pm.dexNo);
          slot.charge1 = DataService.isThirdAttackName(c1Jp) ? (def.charge1 || "") : (c1Jp || def.charge1 || "");
          slot.charge2 = DataService.isThirdAttackName(c2Jp) ? (def.charge2 || "") : (c2Jp || def.charge2 || "");
          slot.third = DataService.parseJsonMoveName(pickToken(src.thirdMoves), pm.dexNo) || def.third || "";
        }
      }
      slots.push(slot);
    }
    logState.pokemons = slots;
    logState.dirty = false;
  }

  async function copyJsonToClipboard() {
    const text = JSON.stringify(buildPartyJson(state), null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) { return false; }
  }

  async function readJsonFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error("clipboard_unavailable");
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) throw new Error("empty");
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { throw new Error("invalid_json"); }
    if (!isValidPartyJson(parsed)) throw new Error("invalid_format");
    return parsed;
  }

  function showJsonErrorOverlay(message) {
    const overlay = $("overlay-json-error");
    if (!overlay) return;
    const msg = $("json-error-message");
    if (msg && message) msg.textContent = message;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }
  function hideJsonErrorOverlay() {
    const overlay = $("overlay-json-error");
    if (overlay) { overlay.classList.remove("active"); overlay.setAttribute("aria-hidden", "true"); }
  }

  function openSheetWithJson(json, slotIndex) {
    activeSlotIndex = typeof slotIndex === "number" ? slotIndex : null;
    sheetOrigin = "slots";
    sheetDirty = false;
    loadSavedInputs();
    applyPartyJson(json);
    bindSheetForm();
    renderPokemonSlots("pokemon-slots");
    showScreen("sheet");
  }

  function openSheetFresh() {
    activeSlotIndex = null;
    sheetOrigin = "menu";
    sheetDirty = false;
    state.recognitionAttempted = false;
    state.moveBugMode = false;
    state.handleName = "";
    state.trainerName = "";
    state.friendCode = "";
    state.pokemons = emptyPokemons();
    loadSavedInputs();
    bindSheetForm();
    updateEngToggleUI();
    updateMoveBugToggleUI();
    renderPokemonSlots("pokemon-slots");
    showScreen("sheet");
  }

  function openSheetWithRecognitionResult(result) {
    activeSlotIndex = null;
    sheetOrigin = "menu";
    sheetDirty = false;
    loadSavedInputs();
    state.recognitionAttempted = result !== null && Array.isArray(result) && result.length >= 6;
    if (result && Array.isArray(result)) {
      result.forEach((r, i) => {
        const slot = state.pokemons[i];
        if (!slot) return;
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
            slot.third = def.third || "";
          }
        }
      });
    } else {
      state.pokemons = emptyPokemons();
    }
    bindSheetForm();
    updateEngToggleUI();
    renderPokemonSlots("pokemon-slots");
    showScreen("sheet");
  }

  function bindSheetForm() {
    const handle = $("input-handle");
    const trainer = $("input-trainer");
    const friend = $("input-friendcode");
    if (handle) {
      handle.value = state.handleName;
      handle.oninput = () => { state.handleName = handle.value; sheetDirty = true; };
    }
    if (trainer) {
      trainer.value = state.trainerName;
      trainer.oninput = () => { state.trainerName = trainer.value; sheetDirty = true; };
    }
    if (friend) {
      friend.value = state.friendCode;
      friend.oninput = () => {
        friend.value = friend.value.replace(/\D/g, "");
        state.friendCode = friend.value;
        sheetDirty = true;
      };
    }
  }

  function clearAllMoves(containerId) {
    const slotState = getSlotState(containerId || "pokemon-slots");
    slotState.pokemons.forEach((p) => {
      p.fast = ""; p.charge1 = ""; p.charge2 = ""; p.third = "";
    });
    if (containerId === "log-pokemon-slots") logState.dirty = true;
    else sheetDirty = true;
    renderPokemonSlots(containerId || "pokemon-slots");
  }

  function updateEngToggleUI() {
    const btn = $("toggle-eng-output");
    if (!btn) return;
    btn.setAttribute("aria-checked", state.engOutput ? "true" : "false");
    const lbl = btn.querySelector(".toggle-label-text");
    if (lbl) lbl.textContent = state.engOutput ? "ON" : "OFF";
  }

  function updateMoveBugToggleUI() {
    const btn = $("toggle-move-bug");
    if (btn) {
      btn.setAttribute("aria-checked", state.moveBugMode ? "true" : "false");
      const lbl = btn.querySelector(".toggle-label-text");
      if (lbl) lbl.textContent = state.moveBugMode ? "ON" : "OFF";
    }
    const btnLog = $("toggle-move-bug-log");
    if (btnLog) {
      btnLog.setAttribute("aria-checked", logState.moveBugMode ? "true" : "false");
      const lbl = btnLog.querySelector(".toggle-label-text");
      if (lbl) lbl.textContent = logState.moveBugMode ? "ON" : "OFF";
    }
  }

  function confirmUnsaved(message, onSave, onDiscard) {
    const overlay = $("overlay-unsaved");
    const msg = $("unsaved-message");
    if (msg) msg.textContent = message || "変更を保存しますか？";
    unsavedCallback = { onSave, onDiscard };
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }
  function closeUnsaved() {
    const overlay = $("overlay-unsaved");
    if (overlay) { overlay.classList.remove("active"); overlay.setAttribute("aria-hidden", "true"); }
    unsavedCallback = null;
  }

  function goAfterSheet(targetScreen) {
    const dest = targetScreen || sheetOrigin || "menu";
    if (dest === "slots") renderSlots();
    showScreen(dest);
  }

  function tryLeaveSheet(targetScreen) {
    const dest = targetScreen || sheetOrigin || "menu";
    if (!sheetDirty && activeSlotIndex === null) {
      goAfterSheet(dest);
      return;
    }
    if (activeSlotIndex !== null && sheetDirty) {
      confirmUnsaved("パーティの変更を保存しますか？", () => {
        saveCurrentToSlot(activeSlotIndex);
        closeUnsaved();
        sheetDirty = false;
        goAfterSheet(dest);
      }, () => {
        closeUnsaved();
        sheetDirty = false;
        activeSlotIndex = null;
        goAfterSheet(dest);
      });
      return;
    }
    goAfterSheet(dest);
  }

  function saveCurrentToSlot(index) {
    const slots = StorageService.getPartySlots();
    const existing = slots[index];
    StorageService.setPartySlot(index, {
      name: existing && existing.name ? existing.name : "",
      at: Date.now(),
      json: buildPartyJson(state),
    });
  }

  async function outputImage() {
    saveEngOutput();
    StorageService.recordInputHistory({
      handleName: state.handleName,
      trainerName: state.trainerName,
      friendCode: state.friendCode,
    });
    showProgress();
    try {
      await document.fonts.ready;
      outputBlob = await SheetRender.renderToBlob(state, setProgress);
    } catch (e) {
      console.error("[画像出力]", e);
      hideProgress();
      return;
    }
    hideProgress();
    if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    try {
      const file = new File([outputBlob], "6-3sheet.png", { type: "image/png" });
      outputBlobUrl = URL.createObjectURL(file);
    } catch (_) {
      outputBlobUrl = URL.createObjectURL(outputBlob);
    }
    openOutputOverlay();
  }

  function openOutputOverlay() {
    const overlay = $("overlay-output");
    const container = $("output-overlay-content");
    if (!overlay || !container) return;
    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = outputBlobUrl;
    img.alt = "6-3sheet";
    container.appendChild(img);
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeOutputOverlay() {
    const overlay = $("overlay-output");
    if (overlay) { overlay.classList.remove("active"); overlay.setAttribute("aria-hidden", "true"); }
  }

  function downloadOutputImage() {
    if (!outputBlob) return;
    const url = outputBlobUrl || URL.createObjectURL(outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "6-3sheet.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`<html><head><title>6-3sheet</title></head><body style="margin:0;background:#eee;"><img src="${url}" alt="6-3sheet" style="max-width:100%;height:auto;"></body></html>`);
        win.document.close();
      }
    }
  }

  function exportCacheData() {
    const data = StorageService.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Ku6-3naTool.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function importCacheData() {
    const input = $("input-backup");
    if (input) input.click();
  }

  async function onBackupFileChosen(e) {
    const file = e.target && e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch (_) {
      alert("JSONを読み込めませんでした");
      return;
    }
    if (!confirm("現在の保存データを置き換えます。よろしいですか？")) return;
    const result = StorageService.importBackup(data);
    if (!result.ok) {
      alert(result.error || "インポートに失敗しました");
      return;
    }
    renderSlots({ stagger: false });
  }

  function openSlotPicker() {
    const overlay = $("overlay-slot-picker");
    const grid = $("slot-picker-grid");
    const slots = StorageService.getPartySlots();
    grid.innerHTML = slots.map((s, i) => {
      const label = s ? (s.name || "スロット" + (i + 1)) : "空きスロット " + (i + 1);
      return `<button type="button" class="slot-picker-btn${s ? " has-data" : ""}" data-slot-index="${i}">${escapeHtml(label)}</button>`;
    }).join("");
    grid.querySelectorAll(".slot-picker-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-slot-index"), 10);
        const slots = StorageService.getPartySlots();
        if (slots[idx]) {
          pendingSlotSaveIndex = idx;
          closeSlotPicker();
          openSlotConfirm();
        } else {
          doSaveToSlot(idx);
        }
      });
    });
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }
  function closeSlotPicker() {
    const overlay = $("overlay-slot-picker");
    if (overlay) { overlay.classList.remove("active"); overlay.setAttribute("aria-hidden", "true"); }
  }
  function openSlotConfirm() {
    $("overlay-slot-confirm").classList.add("active");
    $("overlay-slot-confirm").setAttribute("aria-hidden", "false");
  }
  function closeSlotConfirm() {
    const overlay = $("overlay-slot-confirm");
    if (overlay) { overlay.classList.remove("active"); overlay.setAttribute("aria-hidden", "true"); }
    pendingSlotSaveIndex = null;
  }
  function doSaveToSlot(index) {
    const slots = StorageService.getPartySlots();
    const existing = slots[index];
    StorageService.setPartySlot(index, {
      name: existing && existing.name ? existing.name : "",
      at: Date.now(),
      json: buildPartyJson(state),
    });
    closeSlotPicker();
    closeSlotConfirm();
    pendingSlotSaveIndex = null;
  }

  function renderSlotPokemonRow(json) {
    const basePath = getBasePath();
    if (!json || !Array.isArray(json.pokemons)) {
      return Array(6).fill('<span class="slot-empty"></span>').join("");
    }
    return json.pokemons.map((p) => {
      if (!p || p.dex == null) return '<span class="slot-empty"></span>';
      const pm = DataService ? DataService.getPokemonByDexNo(String(p.dex)) : null;
      const pic = pm && pm.picPath ? basePath.replace(/\/?$/, "/") + pm.picPath : basePath + "Image/Pic/Question_Mark.png";
      return `<img src="${pic}" alt="" onerror="this.style.opacity='0.3'">`;
    }).join("");
  }

  function renderSlots(opts) {
    const container = $("slot-list");
    const slots = StorageService.getPartySlots();
    container.innerHTML = slots.map((s, i) => {
      const name = s ? (s.name || "パーティ" + (i + 1)) : "空きスロット";
      const date = s ? new Date(s.at).toLocaleString("ja-JP") : "";
      const pics = s ? renderSlotPokemonRow(s.json) : Array(6).fill('<span class="slot-empty"></span>').join("");
      const emptyClass = s ? "" : " data-slot-empty";
      const deleteBtn = s ? `<button type="button" class="btn-role btn-danger" data-action="delete" data-index="${i}">削除</button>` : "";
      const renameBtn = s ? `<button type="button" class="btn-role btn-secondary" data-action="rename" data-index="${i}">名前編集</button>` : "";
      return `
        <div class="data-slot-card${emptyClass}" data-slot-index="${i}">
          <button type="button" class="data-slot-handle" aria-label="並べ替え" data-index="${i}">
            <span class="data-slot-handle-bars" aria-hidden="true"></span>
          </button>
          <div class="data-slot-body" data-action="open" data-index="${i}">
            <div class="data-slot-header">
              <span class="data-slot-name">${escapeHtml(name)}</span>
              <span class="data-slot-date">${escapeHtml(date)}</span>
            </div>
            <div class="data-slot-pokemon">${pics}</div>
          </div>
          <div class="data-slot-actions">
            ${renameBtn}
            ${deleteBtn}
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll("[data-action='open']").forEach((el) => {
      const idx = parseInt(el.getAttribute("data-index"), 10);
      const slot = slots[idx];
      if (!slot) return;
      bindSlotTouch(el, () => openSheetWithJson(slot.json, idx));
    });
    container.querySelectorAll("[data-action='rename']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openNameEdit(parseInt(btn.getAttribute("data-index"), 10));
      });
    });
    container.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        if (confirm("このスロットを空にしますか？")) {
          StorageService.clearPartySlot(idx);
          renderSlots({ stagger: false });
        }
      });
    });
    bindSlotReorder(container);
    if (opts && opts.stagger === false) return;
    if (window.AnimService) window.AnimService.initStaggerSlots(container);
  }

  function bindSlotReorder(container) {
    let dragEl = null;
    let startIndex = -1;
    let dragging = false;
    let startY = 0;

    function finish(cancel) {
      if (!dragEl) return;
      const from = startIndex;
      const cards = [...container.querySelectorAll(".data-slot-card")];
      const to = cards.indexOf(dragEl);
      const moved = dragging && from >= 0 && to >= 0 && from !== to;
      dragEl.classList.remove("is-dragging");
      container.classList.remove("is-reordering");
      dragEl = null;
      startIndex = -1;
      dragging = false;
      if (moved && !cancel) StorageService.reorderPartySlots(from, to);
      if (moved || cancel) renderSlots({ stagger: false });
    }

    container.querySelectorAll(".data-slot-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return;
        dragEl = handle.closest(".data-slot-card");
        startIndex = [...container.querySelectorAll(".data-slot-card")].indexOf(dragEl);
        dragging = false;
        startY = e.clientY;
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      handle.addEventListener("pointermove", (e) => {
        if (!dragEl) return;
        if (!dragging && Math.abs(e.clientY - startY) < 6) return;
        if (!dragging) {
          dragging = true;
          dragEl.classList.add("is-dragging");
          container.classList.add("is-reordering");
        }
        const others = [...container.querySelectorAll(".data-slot-card")].filter((c) => c !== dragEl);
        let placed = false;
        for (const el of others) {
          const r = el.getBoundingClientRect();
          if (e.clientY < r.top + r.height / 2) {
            container.insertBefore(dragEl, el);
            placed = true;
            break;
          }
        }
        if (!placed) container.appendChild(dragEl);
      });
      handle.addEventListener("pointerup", () => finish(false));
      handle.addEventListener("pointercancel", () => finish(true));
    });
  }

  function openNameEdit(index) {
    nameEditSlotIndex = index;
    const slots = StorageService.getPartySlots();
    const input = $("name-edit-input");
    if (input) input.value = (slots[index] && slots[index].name) || "";
    $("overlay-name-edit").classList.add("active");
    $("overlay-name-edit").setAttribute("aria-hidden", "false");
    if (input) input.focus();
  }
  function closeNameEdit() {
    $("overlay-name-edit").classList.remove("active");
    $("overlay-name-edit").setAttribute("aria-hidden", "true");
    nameEditSlotIndex = null;
  }

  function renderLogList() {
    const container = $("log-list");
    const logs = StorageService.getBattleLogs();
    if (!logs.length) {
      container.innerHTML = '<p class="list-empty">対戦ログはありません</p>';
      return;
    }
    container.innerHTML = logs.map((log) => {
      const name = "VS " + (log.opponent || "???");
      const date = new Date(log.at).toLocaleString("ja-JP");
      const pics = renderSlotPokemonRow(log.json);
      return `
        <div class="data-slot-card" data-log-id="${escapeHtml(log.id)}">
          <div class="data-slot-body" data-action="edit-log">
            <div class="data-slot-header">
              <span class="data-slot-name">${escapeHtml(name)}</span>
              <span class="data-slot-date">${escapeHtml(date)}</span>
            </div>
            <div class="data-slot-pokemon">${pics}</div>
          </div>
          <div class="data-slot-actions">
            <button type="button" class="btn-role btn-danger" data-action="delete-log">削除</button>
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll(".data-slot-card").forEach((card) => {
      const id = card.getAttribute("data-log-id");
      const body = card.querySelector("[data-action='edit-log']");
      bindSlotTouch(body, () => openLogEdit(id));
      card.querySelector("[data-action='delete-log']").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("この対戦ログを削除しますか？")) {
          StorageService.deleteBattleLog(id);
          renderLogList();
        }
      });
    });
    if (window.AnimService) window.AnimService.initStaggerSlots(container);
  }

  function openLogEdit(id) {
    if (id) {
      const log = StorageService.getBattleLogs().find((l) => l.id === id);
      if (!log) return;
      logState.id = log.id;
      logState.opponent = log.opponent || "";
      logState.moveBugMode = false;
      applyLogJson(log.json || { pokemons: [] });
    } else {
      logState.id = null;
      logState.opponent = "";
      logState.moveBugMode = false;
      logState.pokemons = emptyPokemons();
      logState.dirty = false;
    }
    const opp = $("input-opponent");
    if (opp) {
      opp.value = logState.opponent;
      opp.oninput = () => { logState.opponent = opp.value; logState.dirty = true; };
    }
    updateMoveBugToggleUI();
    renderPokemonSlots("log-pokemon-slots");
    showScreen("logEdit");
  }

  function saveLog() {
    const entry = {
      id: logState.id || StorageService.newId(),
      at: Date.now(),
      opponent: logState.opponent || "",
      json: buildLogJson(),
    };
    StorageService.saveBattleLog(entry);
    logState.dirty = false;
    showScreen("logList");
    renderLogList();
  }

  function tryLeaveLogEdit() {
    if (!logState.dirty) {
      showScreen("logList");
      return;
    }
    confirmUnsaved("対戦ログの変更を保存しますか？", () => {
      saveLog();
      closeUnsaved();
    }, () => {
      closeUnsaved();
      logState.dirty = false;
      showScreen("logList");
    });
  }

  function openRecallMenu(field, anchorEl) {
    recallField = field;
    const history = StorageService.getInputHistory();
    const items = history[field] || [];
    const menu = $("recall-menu");
    const overlay = $("overlay-recall");
    if (!items.length) {
      menu.innerHTML = '<div class="recall-empty">履歴がありません</div>';
    } else {
      menu.innerHTML = items.map((v) => `<button type="button" class="recall-item" data-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join("");
      menu.querySelectorAll(".recall-item").forEach((btn) => {
        btn.addEventListener("click", () => {
          const val = btn.getAttribute("data-value");
          if (field === "handleName") { state.handleName = val; if ($("input-handle")) $("input-handle").value = val; }
          if (field === "trainerName") { state.trainerName = val; if ($("input-trainer")) $("input-trainer").value = val; }
          if (field === "friendCode") { state.friendCode = val; if ($("input-friendcode")) $("input-friendcode").value = val; }
          sheetDirty = true;
          closeRecallMenu();
        });
      });
    }
    const rect = anchorEl.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + "px";
    menu.style.right = Math.max(8, window.innerWidth - rect.right) + "px";
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }
  function closeRecallMenu() {
    $("overlay-recall").classList.remove("active");
    $("overlay-recall").setAttribute("aria-hidden", "true");
    recallField = null;
  }

  function initGuide() {
    const container = $("guide-sections");
    if (!container || !CONFIG || !CONFIG.guideSections) return;
    container.innerHTML = CONFIG.guideSections.map((g, i) => `
      <article class="guide-phase"${i === 0 ? "" : " data-reveal"}>
        <p class="guide-phase-num">${escapeHtml(g.num)}</p>
        <h3 class="guide-phase-title">${escapeHtml(g.title)}</h3>
        <p class="guide-phase-lead">${escapeHtml(g.lead)}</p>
        ${g.image ? `<figure class="guide-phase-figure"><img src="${g.image}" alt="${escapeHtml(g.imageAlt || "")}" width="340" height="600" loading="lazy"></figure>` : ""}
      </article>
      ${i < CONFIG.guideSections.length - 1 ? '<div class="lp-connector" aria-hidden="true"></div>' : ""}
    `).join("");
    if (window.AnimService) window.AnimService.initRevealObserver();
  }

  function initScanHelp() {
    const container = $("scan-help-sections");
    if (!container || !CONFIG || !CONFIG.scanHelpSections) return;
    container.innerHTML = `<h2 class="section-title">上手くいかない時は</h2>` +
      CONFIG.scanHelpSections.map((s) => `
        <div class="scan-help-section">
          <h3>${escapeHtml(s.title)}</h3>
          <p>${s.body.replace(/\n/g, "<br>")}</p>
        </div>`).join("");
  }

  function initMenu() {
    const versionEl = $("app-version");
    if (versionEl && CONFIG && CONFIG.appVersion) versionEl.textContent = CONFIG.appVersion;
    const shareBtn = $("btn-share-x");
    if (shareBtn) {
      const text = "Ku6-3naToolで6-3見せ合いシートを作っています\nhttps://kurosana.github.io/ku6-3naTool/";
      shareBtn.href = "https://x.com/intent/post?text=" + encodeURIComponent(text);
    }
  }

  function initVersionPage() {
    const num = $("version-current-num");
    if (num && CONFIG && CONFIG.appVersion) num.textContent = CONFIG.appVersion;
    const list = $("version-changelog");
    if (!list || !CONFIG || !Array.isArray(CONFIG.appChangelog)) return;
    list.innerHTML = CONFIG.appChangelog.map((entry) => `
      <article class="version-block">
        <h2>${escapeHtml(entry.version || "")}</h2>
        <ul>${(entry.changes || []).map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
      </article>
    `).join("");
  }

  function initImageInput() {
    $("input-image").addEventListener("change", async (e) => {
      const file = e.target && e.target.files[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      beginRecognitionProgress();
      await waitForPaint();
      const img = new Image();
      try {
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("image_load_failed"));
          img.src = URL.createObjectURL(file);
        });
        const result = await Recognition.recognize(img, { onProgress: setProgress });
        openSheetWithRecognitionResult(result);
      } catch (err) {
        const failed = Array(6).fill(null).map(() => ({ dexNo: null, name: null, cp: null, isShadow: false, isLight: false }));
        openSheetWithRecognitionResult(err && err.message === "image_load_failed" ? null : failed);
      } finally {
        endRecognitionProgress();
      }
    });
  }

  function initEventListeners() {
    $("btn-to-menu").addEventListener("click", () => showScreen("menu"));
    $("btn-to-version").addEventListener("click", () => showScreen("version"));
    $("btn-back-version").addEventListener("click", () => showScreen("top"));
    $("btn-back-top").addEventListener("click", () => showScreen("top"));
    $("btn-new-party").addEventListener("click", openSheetFresh);
    $("btn-slots").addEventListener("click", () => { renderSlots(); showScreen("slots"); });
    $("btn-battle-logs").addEventListener("click", () => { renderLogList(); showScreen("logList"); });
    $("btn-back-sheet").addEventListener("click", () => tryLeaveSheet(sheetOrigin));
    $("btn-to-scan").addEventListener("click", () => showScreen("scan"));
    $("btn-back-scan").addEventListener("click", () => showScreen("sheet"));
    $("btn-load-image").addEventListener("click", () => $("input-image").click());
    $("btn-scan-example").addEventListener("click", () => {
      $("overlay-scan-example").classList.add("active");
      $("overlay-scan-example").setAttribute("aria-hidden", "false");
    });
    $("overlay-scan-example").addEventListener("click", () => {
      $("overlay-scan-example").classList.remove("active");
      $("overlay-scan-example").setAttribute("aria-hidden", "true");
    });
    $("btn-back-slots").addEventListener("click", () => showScreen("menu"));
    $("btn-export-data").addEventListener("click", exportCacheData);
    $("btn-import-data").addEventListener("click", importCacheData);
    $("input-backup").addEventListener("change", onBackupFileChosen);
    $("btn-back-log-list").addEventListener("click", () => showScreen("menu"));
    $("btn-new-log").addEventListener("click", () => openLogEdit(null));
    $("btn-back-log-edit").addEventListener("click", tryLeaveLogEdit);
    $("btn-save-log").addEventListener("click", saveLog);
    $("btn-output").addEventListener("click", outputImage);
    $("btn-close-output").addEventListener("click", closeOutputOverlay);
    $("output-backdrop").addEventListener("click", closeOutputOverlay);
    $("btn-download-image").addEventListener("click", downloadOutputImage);
    $("btn-save-to-slot").addEventListener("click", openSlotPicker);
    $("btn-slot-picker-cancel").addEventListener("click", closeSlotPicker);
    $("slot-picker-backdrop").addEventListener("click", closeSlotPicker);
    $("btn-slot-confirm-back").addEventListener("click", closeSlotConfirm);
    $("slot-confirm-backdrop").addEventListener("click", closeSlotConfirm);
    $("btn-slot-confirm-save").addEventListener("click", () => {
      if (pendingSlotSaveIndex !== null) doSaveToSlot(pendingSlotSaveIndex);
    });
    $("btn-name-edit-cancel").addEventListener("click", closeNameEdit);
    $("name-edit-backdrop").addEventListener("click", closeNameEdit);
    $("btn-name-edit-save").addEventListener("click", () => {
      if (nameEditSlotIndex !== null) {
        StorageService.renamePartySlot(nameEditSlotIndex, $("name-edit-input").value);
        renderSlots();
        closeNameEdit();
      }
    });
    $("btn-unsaved-discard").addEventListener("click", () => {
      if (unsavedCallback && unsavedCallback.onDiscard) unsavedCallback.onDiscard();
    });
    $("btn-unsaved-save").addEventListener("click", () => {
      if (unsavedCallback && unsavedCallback.onSave) unsavedCallback.onSave();
    });
    $("unsaved-backdrop").addEventListener("click", closeUnsaved);
    $("recall-backdrop").addEventListener("click", closeRecallMenu);
    document.querySelectorAll(".btn-recall").forEach((btn) => {
      btn.addEventListener("click", () => openRecallMenu(btn.getAttribute("data-recall"), btn));
    });
    $("btn-copy-json").addEventListener("click", async () => {
      const ok = await copyJsonToClipboard();
      const btn = $("btn-copy-json");
      const orig = btn.textContent;
      btn.textContent = ok ? "コピーしました" : "コピー失敗";
      btn.classList.toggle("copied", ok);
      btn.classList.toggle("copy-failed", !ok);
      setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied", "copy-failed"); }, 2000);
    });
    $("btn-clear-moves").addEventListener("click", () => clearAllMoves("pokemon-slots"));
    $("btn-clear-moves-log").addEventListener("click", () => clearAllMoves("log-pokemon-slots"));
    $("toggle-eng-output").addEventListener("click", () => {
      state.engOutput = !state.engOutput;
      updateEngToggleUI();
      saveEngOutput();
    });
    $("toggle-move-bug").addEventListener("click", () => {
      state.moveBugMode = !state.moveBugMode;
      updateMoveBugToggleUI();
      renderPokemonSlots("pokemon-slots");
    });
    $("toggle-move-bug-log").addEventListener("click", () => {
      logState.moveBugMode = !logState.moveBugMode;
      updateMoveBugToggleUI();
      renderPokemonSlots("log-pokemon-slots");
    });
    $("btn-close-search").addEventListener("click", closeSearchOverlay);
    $("btn-close-move-search").addEventListener("click", closeMoveSearchOverlay);
    $("btn-json-error-ok").addEventListener("click", hideJsonErrorOverlay);
    $("overlay-json-error").addEventListener("click", (e) => {
      if (e.target.classList.contains("json-error-backdrop")) hideJsonErrorOverlay();
    });
    $("search-pokemon").addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearchOverlay(); });
    $("search-move").addEventListener("keydown", (e) => { if (e.key === "Escape") closeMoveSearchOverlay(); });
    $("btn-close-debug").addEventListener("click", () => {
      $("overlay-debug-recognition").classList.remove("active");
    });
  }

  // デバッグオーバーレイ（recognition.js から呼ばれる）
  window.showRecognitionDebug = function (image, results, debugData, layout) {
    const overlay = $("overlay-debug-recognition");
    const canvasFull = $("debug-canvas-full");
    const cellsContainer = $("debug-cells");
    if (!overlay || !canvasFull || !cellsContainer) return;
    const w = layout.w;
    const h = layout.h;
    const scale = Math.min(380 / w, 520 / h, 1);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    canvasFull.width = cw;
    canvasFull.height = ch;
    const ctx = canvasFull.getContext("2d");
    ctx.drawImage(image, 0, 0, w, h, 0, 0, cw, ch);
    const zones = layout.zones;
    if (zones) {
      [zones.cp1, zones.cp2].forEach((arr) => { if (arr) arr.forEach((r) => { ctx.strokeStyle = "rgba(0,100,255,0.9)"; ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale); }); });
      [zones.pokemon1, zones.pokemon2].forEach((arr) => { if (arr) arr.forEach((r) => { ctx.strokeStyle = "rgba(255,0,0,0.9)"; ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale); }); });
    }
    const threshold = (CONFIG && CONFIG.imageMatchThreshold) || 0.65;
    cellsContainer.innerHTML = (debugData || []).map((d) => {
      const name = (d.match && d.match.name) ? d.match.name : "未認識";
      const cpText = d.cp != null ? "CP " + d.cp : "CP ---";
      return `<div class="debug-cell-item"><p class="debug-cell-info">スロット${d.index + 1}: ${escapeHtml(name)} ${d.bestScore != null ? d.bestScore.toFixed(3) : "-"}</p><p class="debug-cell-info">${cpText}</p></div>`;
    }).join("");
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  };

  async function boot() {
    try {
      StorageService.migrateFromLegacy();
      await DataService.loadAll();
    } catch (e) {
      console.error(e);
    }
    initGuide();
    initScanHelp();
    initMenu();
    initVersionPage();
    initImageInput();
    initEventListeners();
    loadSavedInputs();
    updateEngToggleUI();
    showScreen("top");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
