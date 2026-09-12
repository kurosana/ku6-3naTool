/**
 * パーティシート画像の描画（プレビュー・出力用）
 * テンプレート上にテキスト・ポケモン画像・技・タイプアイコンを配置
 */

const SheetRender = (function () {
  const CX = 874;
  const CY = 1240;
  const W = 1748;
  const H = 2480;

  const BASE = (function () {
    try {
      return (typeof getBasePath === "function" ? getBasePath() : "") || "./";
    } catch (_) {
      return "./";
    }
  })();

  function px(x, y) {
    return { x: CX + x, y: CY + y };
  }

  const layout = {
    handleName: { pos: px(-630, -895), size: 100, align: "left", baseline: "middle" },
    trainerName: { pos: px(-552, -811), size: 50, align: "left", baseline: "middle" },
    friendCode: { pos: px(475, -780), size: 40, align: "center", baseline: "middle" },
    pokemon: [
      { name: px(-520, -654), size: 75, align: "center", baseline: "middle" },
      { img: px(-522, -414), scale: 6.5 },
      { cp: px(-298, -174), size: 50, align: "right", baseline: "middle" },
      { shadowLight: px(-660, -312), scale: 2.75 },
      { fastType: px(-718, -100), scale: 2.75 },
      { fastName: px(-665, -100), size: 47, align: "left", baseline: "middle" },
      { charge1Type: px(-718, 5), scale: 2.75 },
      { charge1Name: px(-665, 5), size: 47, align: "left", baseline: "middle" },
      { charge2Type: px(-718, 75), scale: 2.75 },
      { charge2Name: px(-665, 75), size: 47, align: "left", baseline: "middle" },
    ],
    pokemonMega: [
      { mega: px(-521, -200) },
      { name: px(-520, -670), size: 60, align: "center", baseline: "middle" },
      { img: px(-522, -444), scale: 6 },
      { cp: px(-298, -220), size: 50, align: "right", baseline: "middle" },
      { shadowLight: px(-660, -312), scale: 2.75 },
      { fastType: px(-722, -145), scale: 2.5 },
      { fastName: px(-682, -145), size: 47, align: "left", baseline: "middle" },
      { charge1Type: px(-722, -65), scale: 2.5 },
      { charge1Name: px(-682, -65), size: 47, align: "left", baseline: "middle" },
      { charge2Type: px(-722, 5), scale: 2.5 },
      { charge2Name: px(-682, 5), size: 47, align: "left", baseline: "middle" },
      { thirdType: px(-722, 75), scale: 2.5 },
      { thirdName: px(-682, 75), size: 47, align: "left", baseline: "middle" },
    ],
    offsets: [
      { dx: 0, dy: 0 },
      { dx: 520, dy: 0 },
      { dx: 1040, dy: 0 },
      { dx: 0, dy: 880 },
      { dx: 520, dy: 880 },
      { dx: 1040, dy: 880 },
    ],
  };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Load: " + src));
      const url = src.startsWith("/") ? src : BASE.replace(/\/?$/, "/") + src;
      img.src = url;
    });
  }

  function drawText(ctx, text, x, y, size, align, baseline) {
    if (!text) return;
    ctx.save();
    ctx.font = `${size}px "RyakjiToge", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
    ctx.textAlign = align || "left";
    ctx.textBaseline = baseline || "middle";
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(String(text), x, y);
    ctx.restore();
  }

  async function drawSheet(state, canvas, isPreview, onProgress) {
    const w = canvas.width || W;
    const h = canvas.height || H;
    const scale = isPreview ? Math.min(w / W, h / H) : 1;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    // Canvas でカスタムフォントを確実に使うため、描画前に明示的にロード
    try { await document.fonts.load('100px "RyakjiToge"'); } catch (_) {}

    // 進捗管理: テンプレート1 + ポケモン6体×7項目
    const TOTAL_WORK = 1 + 6 * 7;
    let doneWork = 0;
    const tick = () => {
      doneWork++;
      if (onProgress) onProgress(Math.min(100, Math.round(doneWork / TOTAL_WORK * 100)));
    };

    ctx.save();
    if (isPreview) ctx.scale(scale, scale);

    const templatePath = (typeof CONFIG !== "undefined" && CONFIG.templatePath) ? CONFIG.templatePath : "Image/Template.png";
    try {
      const templateImg = await loadImage(templatePath);
      ctx.drawImage(templateImg, 0, 0, W, H);
    } catch (_) {
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, W, H);
    }
    tick(); // テンプレート完了

    const handleName = (state.handleName || "").trim();
    const trainerName = (state.trainerName || "").trim();
    const friendCode = (state.friendCode || "").trim();

    const l = layout;
    if (handleName) drawText(ctx, handleName, l.handleName.pos.x, l.handleName.pos.y, l.handleName.size, l.handleName.align, l.handleName.baseline);
    if (trainerName) drawText(ctx, trainerName, l.trainerName.pos.x, l.trainerName.pos.y, l.trainerName.size, l.trainerName.align, l.trainerName.baseline);
    if (friendCode) drawText(ctx, friendCode, l.friendCode.pos.x, l.friendCode.pos.y, l.friendCode.size, l.friendCode.align, l.friendCode.baseline);

    const shadowLightFolder = (typeof CONFIG !== "undefined" && CONFIG.shadowLightIconFolder) ? CONFIG.shadowLightIconFolder : "Image/Type&shadow";

    for (let i = 0; i < 6; i++) {
      const pokemon = (state.pokemons && state.pokemons[i]) || {};
      const off = layout.offsets[i];
      const add = (pos) => ({ x: pos.x + off.dx, y: pos.y + off.dy });

      const pmInfo = (pokemon.dexNo && DataService) ? DataService.getPokemonByDexNo(pokemon.dexNo) : null;
      const isMega = !!(pmInfo && DataService.isMegaPokemon(pmInfo));
      const sl = isMega ? layout.pokemonMega : layout.pokemon;

      // プレビュー・出力では括弧とその中身を除いた短縮名を表示（例: サンドパン(アローラのすがた) → サンドパン）
      const engOutput = !!(state.engOutput);
      const jpName = (pokemon.name || "").replace(/[([（【].*?[)\]）】]/g, "").trim();
      const name = (engOutput && DataService)
        ? DataService.getPokemonEngName(jpName)
        : jpName;
      const dexNo = pokemon.dexNo;
      const cp = pokemon.cp != null && pokemon.cp !== "" ? String(pokemon.cp) : "";
      const isShadow = !!pokemon.isShadow;
      const isLight = !!pokemon.isLight;
      const fast = pokemon.fast || "";
      const charge1 = pokemon.charge1 || "";
      const charge2 = pokemon.charge2 || "";
      const third = pokemon.third || "";

      // メガマークはスロット内の最背面
      if (isMega) {
        try {
          const megaImg = await loadImage(shadowLightFolder + "/mega_trans.png");
          const p0 = add(sl[0].mega);
          const mw = megaImg.naturalWidth;
          const mh = megaImg.naturalHeight;
          ctx.drawImage(megaImg, p0.x - mw / 2, p0.y - mh / 2, mw, mh);
        } catch (_) {}
      }
      tick();

      const nameSpec = isMega ? sl[1] : sl[0];
      const pkNameSize = engOutput
        ? ((typeof CONFIG !== "undefined" && CONFIG.outputEngPokemonNameSize) || 57)
        : nameSpec.size;
      drawText(ctx, name, add(nameSpec.name).x, add(nameSpec.name).y, pkNameSize, nameSpec.align, nameSpec.baseline);

      // ① ポケモン画像
      const imgSpec = isMega ? sl[2] : sl[1];
      const pkIconSize = 64 * (imgSpec.scale || 6.5);
      const recognitionAttempted = !!(state.recognitionAttempted);
      if (dexNo && DataService) {
        const p = DataService.getPokemonByDexNo(dexNo);
        const picPath = (p && p.picPath) || "Image/Pic/" + dexNo + ".png";
        try {
          const img = await loadImage(picPath);
          const p0 = add(imgSpec.img);
          ctx.drawImage(img, p0.x - pkIconSize / 2, p0.y - pkIconSize / 2, pkIconSize, pkIconSize);
        } catch (_) {
          try {
            const q = await loadImage("Image/Pic/Question_Mark.png");
            const p0 = add(imgSpec.img);
            ctx.drawImage(q, p0.x - pkIconSize / 2, p0.y - pkIconSize / 2, pkIconSize, pkIconSize);
          } catch (_) {}
        }
      } else if (recognitionAttempted) {
        try {
          const q = await loadImage("Image/Pic/Question_Mark.png");
          const p0 = add(imgSpec.img);
          ctx.drawImage(q, p0.x - pkIconSize / 2, p0.y - pkIconSize / 2, pkIconSize, pkIconSize);
        } catch (_) {}
      }
      tick(); // ①完了

      const cpSpec = isMega ? sl[3] : sl[2];
      if (cp) drawText(ctx, "CP " + cp, add(cpSpec.cp).x, add(cpSpec.cp).y, cpSpec.size, cpSpec.align, cpSpec.baseline);

      // ② シャドウ/ライトアイコン（メガでも位置は不変 = 通常レイアウトの座標）
      const slSpec = layout.pokemon[3];
      if (isShadow || isLight) {
        const iconName = isShadow ? "shadow.png" : "light.png";
        try {
          const slImg = await loadImage(shadowLightFolder + "/" + iconName);
          const slSize = 64 * slSpec.scale;
          const p0 = add(slSpec.shadowLight);
          ctx.drawImage(slImg, p0.x - slSize / 2, p0.y - slSize / 2, slSize, slSize);
        } catch (_) {}
      }
      tick(); // ②完了

      // ③④⑤⑥ 技タイプアイコン（常に tick することで合計を保証）
      const getMoveType = (m) => DataService ? DataService.getMoveTypeName(m) : null;
      const dispName = (m) => {
        if (!DataService) return m;
        if (engOutput) return DataService.getMoveEngName(m);
        return DataService.getDisplayMoveName(m);
      };
      const nameFast = isMega ? sl[6] : sl[5];
      const moveNameSize = engOutput
        ? ((typeof CONFIG !== "undefined" && CONFIG.outputEngMoveNameSize) || 40)
        : nameFast.size;

      const drawTypeIcon = async (typeName, posObj, scale) => {
        if (!typeName || !DataService) return;
        const path = DataService.getTypeIconPath(typeName);
        if (!path) return;
        try {
          const ti = await loadImage(path);
          const ts = ti.naturalWidth * scale;
          const p0 = add(posObj);
          ctx.drawImage(ti, p0.x - ts / 2, p0.y - ts / 2, ts, ts);
        } catch (_) {}
      };

      const posOf = (entry) => entry.fastType || entry.charge1Type || entry.charge2Type || entry.thirdType
        || entry.fastName || entry.charge1Name || entry.charge2Name || entry.thirdName;

      const drawMove = async (moveName, typeEntry, nameEntry) => {
        if (!moveName) return;
        const typeName = getMoveType(moveName);
        if (typeName) await drawTypeIcon(typeName, posOf(typeEntry), typeEntry.scale);
        drawText(ctx, dispName(moveName), add(posOf(nameEntry)).x, add(posOf(nameEntry)).y, moveNameSize, nameEntry.align, nameEntry.baseline);
      };

      if (isMega) {
        await drawMove(fast, sl[5], sl[6]);
        tick();
        await drawMove(charge1, sl[7], sl[8]);
        tick();
        await drawMove(charge2, sl[9], sl[10]);
        tick();
        await drawMove(third, sl[11], sl[12]);
        tick();
      } else {
        await drawMove(fast, sl[4], sl[5]);
        tick();
        await drawMove(charge1, sl[6], sl[7]);
        tick();
        await drawMove(charge2, sl[8], sl[9]);
        tick();
        tick(); // 非メガはサードなし（進捗枠は確保）
      }
    }

    ctx.restore();
  }

  async function renderToBlob(state, onProgress) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    await drawSheet(state, canvas, false, onProgress);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // iOS Safari 等で toBlob が null を返す場合は toDataURL で代替
          try {
            const dataUrl = canvas.toDataURL("image/png");
            const bin = atob(dataUrl.split(",")[1]);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            resolve(new Blob([arr], { type: "image/png" }));
          } catch (e) {
            reject(new Error("canvas.toBlob returned null and toDataURL fallback failed: " + e.message));
          }
        }
      }, "image/png");
    });
  }

  return { drawSheet, renderToBlob, layout };
})();
