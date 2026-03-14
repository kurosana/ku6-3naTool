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

    // 進捗管理: テンプレート1 + ポケモン6体×5項目(画像・シャドウ・技タイプ×3) = 31ワーク
    const TOTAL_WORK = 1 + 6 * 5;
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
    const iconSize = 64 * layout.pokemon[1].scale;

    for (let i = 0; i < 6; i++) {
      const pokemon = (state.pokemons && state.pokemons[i]) || {};
      const off = layout.offsets[i];
      const add = (pos) => ({ x: pos.x + off.dx, y: pos.y + off.dy });

      // プレビュー・出力では括弧とその中身を除いた短縮名を表示（例: サンドパン(アローラのすがた) → サンドパン）
      const name = (pokemon.name || "").replace(/[([（【].*?[)\]）】]/g, "").trim();
      const dexNo = pokemon.dexNo;
      const cp = pokemon.cp != null && pokemon.cp !== "" ? String(pokemon.cp) : "";
      const isShadow = !!pokemon.isShadow;
      const isLight = !!pokemon.isLight;
      const fast = pokemon.fast || "";
      const charge1 = pokemon.charge1 || "";
      const charge2 = pokemon.charge2 || "";

      drawText(ctx, name, add(l.pokemon[0].name).x, add(l.pokemon[0].name).y, l.pokemon[0].size, l.pokemon[0].align, l.pokemon[0].baseline);

      // ① ポケモン画像
      const recognitionAttempted = !!(state.recognitionAttempted);
      if (dexNo && DataService) {
        const p = DataService.getPokemonByDexNo(dexNo);
        const picPath = (p && p.picPath) || "Image/Pic/" + dexNo + ".png";
        try {
          const img = await loadImage(picPath);
          const p0 = add(l.pokemon[1].img);
          ctx.drawImage(img, p0.x - iconSize / 2, p0.y - iconSize / 2, iconSize, iconSize);
        } catch (_) {
          try {
            const q = await loadImage("Image/Pic/Question_Mark.png");
            const p0 = add(l.pokemon[1].img);
            ctx.drawImage(q, p0.x - iconSize / 2, p0.y - iconSize / 2, iconSize, iconSize);
          } catch (_) {}
        }
      } else if (recognitionAttempted) {
        try {
          const q = await loadImage("Image/Pic/Question_Mark.png");
          const p0 = add(l.pokemon[1].img);
          ctx.drawImage(q, p0.x - iconSize / 2, p0.y - iconSize / 2, iconSize, iconSize);
        } catch (_) {}
      }
      tick(); // ①完了

      if (cp) drawText(ctx, "CP " + cp, add(l.pokemon[2].cp).x, add(l.pokemon[2].cp).y, l.pokemon[2].size, l.pokemon[2].align, l.pokemon[2].baseline);

      // ② シャドウ/ライトアイコン
      if (isShadow || isLight) {
        const iconName = isShadow ? "shadow.png" : "light.png";
        try {
          const slImg = await loadImage(shadowLightFolder + "/" + iconName);
          const slSize = 64 * l.pokemon[3].scale;
          const p0 = add(l.pokemon[3].shadowLight);
          ctx.drawImage(slImg, p0.x - slSize / 2, p0.y - slSize / 2, slSize, slSize);
        } catch (_) {}
      }
      tick(); // ②完了

      // ③④⑤ 技タイプアイコン（常に tick することで合計を保証）
      const getMoveType = (m) => DataService ? DataService.getMoveTypeName(m) : null;
      const dispName = (m) => DataService ? DataService.getDisplayMoveName(m) : m;

      const drawTypeIcon = async (typeName, posObj) => {
        if (!typeName || !DataService) return;
        const path = DataService.getTypeIconPath(typeName);
        if (!path) return;
        try {
          const ti = await loadImage(path);
          // 画像の実サイズ × 275% で描画（24px画像なら66px、64px画像なら176px）
          const ts = ti.naturalWidth * layout.pokemon[4].scale;
          const p0 = add(posObj);
          ctx.drawImage(ti, p0.x - ts / 2, p0.y - ts / 2, ts, ts);
        } catch (_) {}
      };

      const fastType = getMoveType(fast);
      if (fast) {
        if (fastType) await drawTypeIcon(fastType, l.pokemon[4].fastType);
        drawText(ctx, dispName(fast), add(l.pokemon[5].fastName).x, add(l.pokemon[5].fastName).y, l.pokemon[5].size, l.pokemon[5].align, l.pokemon[5].baseline);
      }
      tick(); // ③完了

      const charge1Type = getMoveType(charge1);
      if (charge1) {
        if (charge1Type) await drawTypeIcon(charge1Type, l.pokemon[6].charge1Type);
        drawText(ctx, dispName(charge1), add(l.pokemon[7].charge1Name).x, add(l.pokemon[7].charge1Name).y, l.pokemon[7].size, l.pokemon[7].align, l.pokemon[7].baseline);
      }
      tick(); // ④完了

      const charge2Type = getMoveType(charge2);
      if (charge2) {
        if (charge2Type) await drawTypeIcon(charge2Type, l.pokemon[8].charge2Type);
        drawText(ctx, dispName(charge2), add(l.pokemon[9].charge2Name).x, add(l.pokemon[9].charge2Name).y, l.pokemon[9].size, l.pokemon[9].align, l.pokemon[9].baseline);
      }
      tick(); // ⑤完了
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
