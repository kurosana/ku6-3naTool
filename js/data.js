/**
 * データ読み込み・CSV解析・ポケモン/技/タイプの取得
 * すべてローカル（同一オリジン）のDataフォルダからfetchします。
 */

const DataService = (function () {
  const BASE = (function () {
    try {
      const b = typeof getBasePath === "function" ? getBasePath() : "";
      return b || "./";
    } catch (_) {
      return "./";
    }
  })();

  let pokemonList = [];
  let moveList = [];
  let pokeMovelist = [];
  let typeMap = {};
  let pokemonEngMap = {}; // 日本語名 → 英語名
  let moveEngMap = {};    // 日本語名 → 英語名
  let ready = false;

  function parseCSV(text) {
    const raw = text.replace(/\uFEFF/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = raw.split("\n").filter((l) => l.trim());
    return lines.map((line) => {
      const parts = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuote = !inQuote;
        } else if ((c === "," && !inQuote) || (c === "\n" && !inQuote)) {
          parts.push(cur.trim());
          cur = "";
        } else {
          cur += c;
        }
      }
      parts.push(cur.trim());
      return parts;
    });
  }

  async function fetchText(path) {
    const url = path.startsWith("/") ? path : BASE.replace(/\/?$/, "/") + path;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load: " + path);
    return res.text();
  }

  async function loadAll() {
    if (ready) return;
    const [pokemonCsv, moveCsv, pokeMoveCsv, typeCsv, pokeEngCsv, moveEngCsv] = await Promise.all([
      fetchText("Data/pokemon_list.csv"),
      fetchText("Data/move_list.csv"),
      fetchText("Data/poke_movelist.csv"),
      fetchText("Data/type.csv"),
      fetchText("Data/poke_englist.csv").catch(() => ""),
      fetchText("Data/move_englist.csv").catch(() => ""),
    ]);

    pokemonList = parseCSV(pokemonCsv).map((row) => ({
      dexNo: row[0],
      name: row[1],
      matchPath: row[2],
      picPath: row[3],
      defaultFast: row[4] || "",
      defaultCharge1: row[5] || "",
      defaultCharge2: row[6] || "",
    }));

    moveList = parseCSV(moveCsv).map((row) => ({
      kind: parseInt(row[0], 10),
      name: row[1],
      type: row[2],
      priority: parseInt(row[3], 10) || 99,
    }));

    const moveByName = {};
    moveList.forEach((m) => {
      moveByName[m.name] = m;
    });

    pokeMovelist = parseCSV(pokeMoveCsv).map((row) => ({
      kind: parseInt(row[0], 10),
      dexNo: row[1],
      name: row[2],
      moves: row.slice(3).filter(Boolean),
    }));

    parseCSV(typeCsv).forEach((row) => {
      const typeName = row[0];
      const path = row[1] || "";
      const filename = path.split("/").pop() || "";
      const iconPath = (typeof CONFIG !== "undefined" && CONFIG.typeIconFolder)
        ? CONFIG.typeIconFolder + "/" + filename
        : path;
      typeMap[typeName] = iconPath;
    });

    // 英語名マップ（1行目はヘッダー行なのでスキップ）
    parseCSV(pokeEngCsv).slice(1).forEach((row) => {
      if (row[0] && row[1]) pokemonEngMap[row[0].trim()] = row[1].trim();
    });
    parseCSV(moveEngCsv).slice(1).forEach((row) => {
      if (row[0] && row[1]) moveEngMap[row[0].trim()] = row[1].trim();
    });

    ready = true;
  }

  function getPokemonList() {
    return pokemonList;
  }

  function getPokemonByDexNo(dexNo) {
    const normalized = String(dexNo).replace(/#+$/, "");
    return pokemonList.find((p) => p.dexNo === normalized || p.dexNo === dexNo)
      || pokemonList.find((p) => String(p.dexNo).replace(/#+$/, "") === normalized);
  }

  function getPokemonByName(name) {
    return pokemonList.find((p) => p.name === name);
  }

  // ひらがな → カタカナ変換（検索時にひらがな入力でもヒットさせるため）
  function toKatakana(str) {
    return str.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  }

  function searchPokemon(query) {
    const q = toKatakana((query || "").trim().toLowerCase());
    if (!q) return pokemonList.slice(0, 100);
    return pokemonList.filter((p) => toKatakana(p.name.toLowerCase()).includes(q)).slice(0, 100);
  }

  function getMovesForPokemon(dexNo) {
    const key = String(dexNo);
    const fast = pokeMovelist.filter((r) => r.kind === 0 && r.dexNo === key);
    const charge = pokeMovelist.filter((r) => r.kind === 1 && r.dexNo === key);
    return {
      fast: (fast[0] && fast[0].moves) || [],
      charge: (charge[0] && charge[0].moves) || [],
    };
  }

  function getMoveInfo(moveName) {
    return moveList.find((m) => m.name === moveName);
  }

  function getDefaultMoves(pokemon) {
    const dexNo = pokemon.dexNo;
    const customFast = (pokemon.defaultFast || "").trim();
    const customCharge1 = (pokemon.defaultCharge1 || "").trim();
    const customCharge2 = (pokemon.defaultCharge2 || "").trim();
    const { fast: fastMoves, charge: chargeMoves } = getMovesForPokemon(dexNo);

    let fast = customFast;
    let c1 = customCharge1;
    let c2 = customCharge2;

    if (!fast && fastMoves.length) {
      const fastWithPriority = fastMoves
        .map((name) => ({ name, info: getMoveInfo(name) }))
        .filter((x) => x.info)
        .sort((a, b) => (a.info.priority || 99) - (b.info.priority || 99));
      fast = fastWithPriority[0] ? fastWithPriority[0].name : fastMoves[0];
    }
    if ((!c1 || !c2) && chargeMoves.length) {
      const chargeWithPriority = chargeMoves
        .map((name) => ({ name, info: getMoveInfo(name) }))
        .filter((x) => x.info)
        .sort((a, b) => (a.info.priority || 99) - (b.info.priority || 99));
      if (!c1) c1 = chargeWithPriority[0] ? chargeWithPriority[0].name : chargeMoves[0];
      if (!c2) c2 = chargeWithPriority[1] ? chargeWithPriority[1].name : chargeMoves[chargeWithPriority.length > 1 ? 1 : 0];
    }
    return { fast: fast || "", charge1: c1 || "", charge2: c2 || "" };
  }

  function getTypeIconPath(typeName) {
    return typeMap[typeName] || "";
  }

  /**
   * 技名の表示用文字列を返す（内部データは変更しない）
   * - "めざめるパワーほのお" → "めざめるパワー"
   * - "わざ名（タイプ）" のような括弧付き → "わざ名"
   */
  function getDisplayMoveName(moveName) {
    if (!moveName) return moveName;
    if (/^めざめるパワー./.test(moveName)) return "めざめるパワー";
    return moveName.replace(/[（(][^）)]*[）)]/g, "").trim();
  }

  /**
   * ポケモン名（日本語・括弧除去済み）→ 英語名。なければ元の名前をそのまま返す
   */
  function getPokemonEngName(jpName) {
    if (!jpName) return jpName;
    return pokemonEngMap[jpName] || jpName;
  }

  /**
   * 技名（日本語）→ 英語表示名。
   * まず getDisplayMoveName で短縮してから英語マップを引く。
   * "めざめるパワー〇〇" は "めざめるパワー" → "Hidden Power" として返す。
   */
  function getMoveEngName(moveName) {
    if (!moveName) return moveName;
    const disp = getDisplayMoveName(moveName); // 括弧除去・めざパ短縮
    return moveEngMap[disp] || disp;
  }

  /**
   * 技名からタイプ名を返す（タイプアイコン表示用）
   * - "めざめるパワーほのお" → "ほのお"（move_list.csv に頼らず後ろのタイプ名を使用）
   * - 通常技 → move_list.csv のタイプ
   */
  function getMoveTypeName(moveName) {
    if (!moveName) return null;
    const m = moveName.match(/^めざめるパワー(.+)$/);
    if (m) return m[1];
    const info = getMoveInfo(moveName);
    return info ? info.type : null;
  }

  return {
    loadAll,
    getPokemonList,
    getPokemonByDexNo,
    getPokemonByName,
    searchPokemon,
    getMovesForPokemon,
    getMoveInfo,
    getDefaultMoves,
    getTypeIconPath,
    getDisplayMoveName,
    getMoveTypeName,
    getPokemonEngName,
    getMoveEngName,
    get moveList() {
      return moveList;
    },
    isReady() {
      return ready;
    },
  };
})();
