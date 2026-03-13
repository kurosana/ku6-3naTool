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

  async function drawSheet(state, canvas, isPreview) {
    const w = canvas.width || W;
    const h = canvas.height || H;
    const scale = isPreview ? Math.min(w / W, h / H) : 1;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

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

    const handleName = (state.handleName || "").trim();
    const trainerName = (state.trainerName || "").trim();
    const friendCode = (state.friendCode || "").trim();

    const l = layout;
    if (handleName) drawText(ctx, handleName, l.handleName.pos.x, l.handleName.pos.y, l.handleName.size, l.handleName.align, l.handleName.baseline);
    if (trainerName) drawText(ctx, trainerName, l.trainerName.pos.x, l.trainerName.pos.y, l.trainerName.size, l.trainerName.align, l.trainerName.baseline);
    if (friendCode) drawText(ctx, friendCode, l.friendCode.pos.x, l.friendCode.pos.y, l.friendCode.size, l.friendCode.align, l.friendCode.baseline);

    const typeFolder = (typeof CONFIG !== "undefined" && CONFIG.typeIconFolder) ? CONFIG.typeIconFolder : "Image/Type&shadow";
    const shadowLightFolder = (typeof CONFIG !== "undefined" && CONFIG.shadowLightIconFolder) ? CONFIG.shadowLightIconFolder : "Image/Type&shadow";
    const iconSize = 64 * (layout.pokemon[1].scale / 6.5);
    const typeIconSize = 64 * (layout.pokemon[4].scale / 6.5);

    for (let i = 0; i < 6; i++) {
      const pokemon = (state.pokemons && state.pokemons[i]) || {};
      const off = layout.offsets[i];
      const add = (pos) => ({ x: pos.x + off.dx, y: pos.y + off.dy });

      const name = pokemon.name || "";
      const dexNo = pokemon.dexNo;
      const cp = pokemon.cp != null && pokemon.cp !== "" ? String(pokemon.cp) : "";
      const isShadow = !!pokemon.isShadow;
      const isLight = !!pokemon.isLight;
      const fast = pokemon.fast || "";
      const charge1 = pokemon.charge1 || "";
      const charge2 = pokemon.charge2 || "";

      drawText(ctx, name, add(l.pokemon[0].name).x, add(l.pokemon[0].name).y, l.pokemon[0].size, l.pokemon[0].align, l.pokemon[0].baseline);

      const recognitionAttempted = !!(state.recognitionAttempted);
      if (dexNo && DataService) {
        const p = DataService.getPokemonByDexNo(dexNo);
        const picPath = (p && p.picPath) || "Image/Pic/" + dexNo + ".png";
        try {
          const img = await loadImage(picPath);
          const sz = img.naturalWidth === 128 ? iconSize / 2 : iconSize;
          const p0 = add(l.pokemon[1].img);
          ctx.drawImage(img, p0.x - sz / 2, p0.y - sz / 2, sz, sz);
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

      if (cp) drawText(ctx, cp, add(l.pokemon[2].cp).x, add(l.pokemon[2].cp).y, l.pokemon[2].size, l.pokemon[2].align, l.pokemon[2].baseline);

      if (!isPreview && (isShadow || isLight)) {
        const iconName = isShadow ? "shadow.png" : "light.png";
        try {
          const slImg = await loadImage(shadowLightFolder + "/" + iconName);
          const slSize = 64 * (l.pokemon[3].scale / 6.5);
          const p0 = add(l.pokemon[3].shadowLight);
          ctx.drawImage(slImg, p0.x - slSize / 2, p0.y - slSize / 2, slSize, slSize);
        } catch (_) {}
      }

      const drawTypeIcon = async (typeName, posObj) => {
        if (!typeName || !DataService) return;
        const path = DataService.getTypeIconPath(typeName);
        if (!path) return;
        try {
          const ti = await loadImage(path);
          const p0 = add(posObj);
          const ts = typeIconSize;
          ctx.drawImage(ti, p0.x - ts / 2, p0.y - ts / 2, ts, ts);
        } catch (_) {}
      };

      const moveInfo = (m) => (DataService && DataService.getMoveInfo(m));
      if (fast) {
        const info = moveInfo(fast);
        if (info) await drawTypeIcon(info.type, l.pokemon[4].fastType);
        drawText(ctx, fast, add(l.pokemon[5].fastName).x, add(l.pokemon[5].fastName).y, l.pokemon[5].size, l.pokemon[5].align, l.pokemon[5].baseline);
      }
      if (charge1) {
        const info = moveInfo(charge1);
        if (info) await drawTypeIcon(info.type, l.pokemon[6].charge1Type);
        drawText(ctx, charge1, add(l.pokemon[7].charge1Name).x, add(l.pokemon[7].charge1Name).y, l.pokemon[7].size, l.pokemon[7].align, l.pokemon[7].baseline);
      }
      if (charge2) {
        const info = moveInfo(charge2);
        if (info) await drawTypeIcon(info.type, l.pokemon[8].charge2Type);
        drawText(ctx, charge2, add(l.pokemon[9].charge2Name).x, add(l.pokemon[9].charge2Name).y, l.pokemon[9].size, l.pokemon[9].align, l.pokemon[9].baseline);
      }
    }

    ctx.restore();
  }

  async function renderToBlob(state) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    await drawSheet(state, canvas, false);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  return { drawSheet, renderToBlob, layout };
})();
