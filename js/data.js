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
  let pokemonEngToJpMap = {}; // 英語名（lower） → 日本語名
  let moveEngToJpMap = {};    // 正規化トークン（FEINT_ATTACK） → 日本語名
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
      megaTag: row[7] || "",
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
      if (row[0] && row[1]) {
        const jp = row[0].trim();
        const en = row[1].trim();
        pokemonEngMap[jp] = en;
        pokemonEngToJpMap[en.toLowerCase()] = jp;
      }
    });
    parseCSV(moveEngCsv).slice(1).forEach((row) => {
      if (row[0] && row[1]) {
        const jp = row[0].trim();
        const en = row[1].trim();
        moveEngMap[jp] = en;
        const token = normalizeMoveToken(en);
        if (token) moveEngToJpMap[token] = jp;
      }
    });

    ready = true;
  }

  // 英語技名 → "FEINT_ATTACK" 形式トークン化
  // 大文字化 → 空白/ハイフンを _ に → 英数字とアンダースコア以外を除去
  function normalizeMoveToken(engName) {
    if (!engName) return "";
    return String(engName)
      .toUpperCase()
      .replace(/[\s\-]+/g, "_")
      .replace(/[^A-Z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
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

  // ローマ字 → カタカナ（ヘボン式・訓令式。最長一致。DBは増やさない）
  const ROMAJI_TO_KANA = [
    ["kya", "キャ"], ["kyu", "キュ"], ["kyo", "キョ"],
    ["gya", "ギャ"], ["gyu", "ギュ"], ["gyo", "ギョ"],
    ["sha", "シャ"], ["shu", "シュ"], ["sho", "ショ"], ["she", "シェ"],
    ["sya", "シャ"], ["syu", "シュ"], ["syo", "ショ"],
    ["cha", "チャ"], ["chu", "チュ"], ["cho", "チョ"], ["che", "チェ"], ["chi", "チ"],
    ["tya", "チャ"], ["tyu", "チュ"], ["tyo", "チョ"], ["thi", "ティ"],
    ["cya", "チャ"], ["cyu", "チュ"], ["cyo", "チョ"],
    ["nya", "ニャ"], ["nyu", "ニュ"], ["nyo", "ニョ"],
    ["hya", "ヒャ"], ["hyu", "ヒュ"], ["hyo", "ヒョ"],
    ["mya", "ミャ"], ["myu", "ミュ"], ["myo", "ミョ"],
    ["rya", "リャ"], ["ryu", "リュ"], ["ryo", "リョ"],
    ["jya", "ジャ"], ["jyu", "ジュ"], ["jyo", "ジョ"],
    ["ja", "ジャ"], ["ju", "ジュ"], ["jo", "ジョ"], ["je", "ジェ"],
    ["bya", "ビャ"], ["byu", "ビュ"], ["byo", "ビョ"],
    ["pya", "ピャ"], ["pyu", "ピュ"], ["pyo", "ピョ"],
    ["dya", "ヂャ"], ["dyu", "ヂュ"], ["dyo", "ヂョ"],
    ["dhi", "ディ"], ["dhu", "ドゥ"],
    ["tsu", "ツ"], ["tsa", "ツァ"], ["tsi", "ツィ"], ["tse", "ツェ"], ["tso", "ツォ"],
    ["xtu", "ッ"], ["xtsu", "ッ"], ["ltu", "ッ"], ["ltsu", "ッ"],
    ["xya", "ャ"], ["xyu", "ュ"], ["xyo", "ョ"],
    ["lya", "ャ"], ["lyu", "ュ"], ["lyo", "ョ"],
    ["kwa", "クァ"], ["kwi", "クィ"], ["kwe", "クェ"], ["kwo", "クォ"],
    ["gwa", "グァ"],
    ["shi", "シ"],
    ["fu", "フ"],
    ["va", "ヴァ"], ["vi", "ヴィ"], ["vu", "ヴ"], ["ve", "ヴェ"], ["vo", "ヴォ"],
    ["fa", "ファ"], ["fi", "フィ"], ["fe", "フェ"], ["fo", "フォ"],
    ["wha", "ウァ"], ["whe", "ウェ"], ["who", "ウォ"],
    ["ka", "カ"], ["ki", "キ"], ["ku", "ク"], ["ke", "ケ"], ["ko", "コ"],
    ["sa", "サ"], ["si", "シ"], ["su", "ス"], ["se", "セ"], ["so", "ソ"],
    ["ta", "タ"], ["ti", "チ"], ["tu", "ツ"], ["te", "テ"], ["to", "ト"],
    ["na", "ナ"], ["ni", "ニ"], ["nu", "ヌ"], ["ne", "ネ"], ["no", "ノ"],
    ["ha", "ハ"], ["hi", "ヒ"], ["hu", "フ"], ["he", "ヘ"], ["ho", "ホ"],
    ["ma", "マ"], ["mi", "ミ"], ["mu", "ム"], ["me", "メ"], ["mo", "モ"],
    ["ya", "ヤ"], ["yu", "ユ"], ["yo", "ヨ"],
    ["ra", "ラ"], ["ri", "リ"], ["ru", "ル"], ["re", "レ"], ["ro", "ロ"],
    ["wa", "ワ"], ["wi", "ウィ"], ["we", "ウェ"], ["wo", "ヲ"],
    ["ga", "ガ"], ["gi", "ギ"], ["gu", "グ"], ["ge", "ゲ"], ["go", "ゴ"],
    ["za", "ザ"], ["zi", "ジ"], ["zu", "ズ"], ["ze", "ゼ"], ["zo", "ゾ"],
    ["da", "ダ"], ["di", "ヂ"], ["du", "ヅ"], ["de", "デ"], ["do", "ド"],
    ["ba", "バ"], ["bi", "ビ"], ["bu", "ブ"], ["be", "ベ"], ["bo", "ボ"],
    ["pa", "パ"], ["pi", "ピ"], ["pu", "プ"], ["pe", "ペ"], ["po", "ポ"],
    ["ji", "ジ"],
    ["ye", "イェ"],
    ["xa", "ァ"], ["xi", "ィ"], ["xu", "ゥ"], ["xe", "ェ"], ["xo", "ォ"],
    ["la", "ァ"], ["li", "ィ"], ["lu", "ゥ"], ["le", "ェ"], ["lo", "ォ"],
    ["a", "ア"], ["i", "イ"], ["u", "ウ"], ["e", "エ"], ["o", "オ"],
  ].sort((a, b) => b[0].length - a[0].length);

  function romajiToKatakana(input) {
    const s = String(input || "").toLowerCase();
    let out = "";
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "-" || ch === "ー") {
        out += "ー";
        i++;
        continue;
      }
      if (ch === "'" || ch === "’") {
        i++;
        continue;
      }
      if (ch < "a" || ch > "z") {
        out += ch;
        i++;
        continue;
      }

      const next = s[i + 1] || "";

      // ヘボン式: n の代わりに m + b/p/m
      if (ch === "m" && (next === "b" || next === "p" || (next === "m" && s[i + 2] && "aiueo".indexOf(s[i + 2]) < 0))) {
        out += "ン";
        i++;
        continue;
      }

      // 促音（っか など）。n は撥音なので除外
      if (next && ch === next && ch !== "n" && "bcdfghjklmpqrstvwxyz".indexOf(ch) >= 0) {
        out += "ッ";
        i++;
        continue;
      }

      // ん: n' / 語末 / 子音の前（nya は除外）
      if (ch === "n") {
        if (!next) {
          out += "ン";
          i++;
          continue;
        }
        if (next === "'" || next === "’") {
          out += "ン";
          i += 2;
          continue;
        }
        if (next === "n") {
          out += "ン";
          i++;
          continue;
        }
        if ("aiueoy".indexOf(next) < 0) {
          out += "ン";
          i++;
          continue;
        }
      }

      let matched = false;
      for (let p = 0; p < ROMAJI_TO_KANA.length; p++) {
        const roma = ROMAJI_TO_KANA[p][0];
        if (s.substr(i, roma.length) === roma) {
          out += ROMAJI_TO_KANA[p][1];
          i += roma.length;
          matched = true;
          break;
        }
      }
      // 音にならない余り（pikach の ch など）は捨てて打ち切り
      if (!matched) break;
    }
    return out;
  }

  let searchPriorityDex = [];

  function setSearchPriority(dexNos) {
    const seen = {};
    const list = [];
    (dexNos || []).forEach((d) => {
      const key = String(d == null ? "" : d).replace(/#+$/, "");
      if (!key || seen[key]) return;
      seen[key] = true;
      list.push(key);
    });
    searchPriorityDex = list;
  }

  function searchPokemon(query) {
    const raw = (query || "").trim();
    if (!raw) {
      const seen = {};
      const out = [];
      searchPriorityDex.forEach((dex) => {
        const p = getPokemonByDexNo(dex);
        if (p && !seen[p.dexNo]) {
          seen[p.dexNo] = true;
          out.push(p);
        }
      });
      pokemonList.forEach((p) => {
        if (out.length >= 100) return;
        if (!seen[p.dexNo]) {
          seen[p.dexNo] = true;
          out.push(p);
        }
      });
      return out.slice(0, 100);
    }
    const qKana = toKatakana(raw.toLowerCase());
    const qRoma = romajiToKatakana(raw);
    return pokemonList.filter((p) => {
      const name = toKatakana(p.name.toLowerCase());
      if (qKana && name.includes(qKana)) return true;
      if (qRoma && qRoma !== qKana && name.includes(qRoma)) return true;
      return false;
    }).slice(0, 100);
  }

  const CHARGE_PLUS_KEEP_AS_SPECIAL = ["せいなるほのお", "エアロブラスト"];

  function normalizePlusName(name) {
    return String(name || "").replace(/＋/g, "+").trim();
  }

  function isThirdAttackName(name) {
    const n = normalizePlusName(name);
    if (!/\+$/.test(n)) return false;
    return !CHARGE_PLUS_KEEP_AS_SPECIAL.some((prefix) => n.startsWith(prefix));
  }

  function getMovesForPokemon(dexNo) {
    const key = String(dexNo);
    const fast = pokeMovelist.filter((r) => r.kind === 0 && r.dexNo === key);
    const charge = pokeMovelist.filter((r) => r.kind === 1 && r.dexNo === key);
    const third = pokeMovelist.filter((r) => r.kind === 2 && r.dexNo === key);
    const pm = getPokemonByDexNo(key);
    const mega = isMegaPokemon(pm);
    const chargeMoves = ((charge[0] && charge[0].moves) || []).filter((m) => !isThirdAttackName(m));
    const thirdMoves = mega
      ? listUnique([
          ...((third[0] && third[0].moves) || []),
          ...((charge[0] && charge[0].moves) || []),
        ].filter(isThirdAttackName))
      : [];
    return {
      fast: (fast[0] && fast[0].moves) || [],
      charge: chargeMoves,
      third: thirdMoves,
    };
  }

  function listUnique(arr) {
    const seen = {};
    const out = [];
    (arr || []).forEach((x) => {
      if (!x || seen[x]) return;
      seen[x] = true;
      out.push(x);
    });
    return out;
  }

  function getRegisteredThird(dexNo) {
    const third = getMovesForPokemon(dexNo).third || [];
    return third[0] || "";
  }

  function isMegaPokemon(pokemon) {
    if (!pokemon) return false;
    if (pokemon.megaTag) return true;
    const name = String(pokemon.name || "");
    const dex = String(pokemon.dexNo || "");
    return name.startsWith("メガ") && dex.indexOf("-") >= 0;
  }

  /**
   * 全わざリストから検索（kind: 0=通常技, 1=ゲージ技, 2=サードアタック）
   * ポケモン検索と同様、ひらがな入力でもカタカナ技名にヒットする。
   */
  function searchMoves(query, kind) {
    const k = kind === 1 ? 1 : kind === 2 ? 2 : 0;
    let pool = moveList.filter((m) => m.kind === k);
    if (k === 1) pool = pool.filter((m) => !isThirdAttackName(m.name));
    if (k === 2) pool = pool.filter((m) => isThirdAttackName(m.name));
    const q = toKatakana((query || "").trim().toLowerCase());
    if (!q) return pool.slice(0, 100);
    return pool.filter((m) => toKatakana(String(m.name || "").toLowerCase()).includes(q)).slice(0, 100);
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
    let c1 = isThirdAttackName(customCharge1) ? "" : customCharge1;
    let c2 = isThirdAttackName(customCharge2) ? "" : customCharge2;

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
    return { fast: fast || "", charge1: c1 || "", charge2: c2 || "", third: getRegisteredThird(dexNo) };
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
   * 英語の種族名（speciesName）から日本語名のポケモンオブジェクトを返す。
   * 大文字小文字は無視。見つからなければ null。
   */
  function getPokemonByEngName(engName) {
    if (!engName) return null;
    const jp = pokemonEngToJpMap[String(engName).trim().toLowerCase()];
    if (!jp) return null;
    return pokemonList.find((p) => p.name === jp) || null;
  }

  /**
   * 日本語技名 → JSON 用トークン（"FEINT_ATTACK" 形式）。
   * 英語名が未登録なら空文字を返す。
   */
  function formatMoveForJson(jpName) {
    if (!jpName) return "";
    const eng = getMoveEngName(jpName);
    return normalizeMoveToken(eng);
  }

  /**
   * JSON 内の技トークン（"FEINT_ATTACK"）→ 日本語技名。
   * dexNo を渡された場合、そのポケモンが覚える技に絞って一致するものを優先する。
   * 見つからなければ空文字を返す。
   */
  function parseJsonMoveName(token, dexNo) {
    if (!token) return "";
    const norm = normalizeMoveToken(token);
    if (!norm) return "";
    const jp = moveEngToJpMap[norm];
    if (!jp) return "";
    if (dexNo) {
      const moves = getMovesForPokemon(dexNo);
      const all = (moves.fast || []).concat(moves.charge || []).concat(moves.third || []);
      // 「めざめるパワー〇〇」のように同一英語名で複数ある場合は当該ポケモンが覚えるものを優先
      if (jp === "めざめるパワー") {
        const owned = all.find((m) => /^めざめるパワー/.test(m));
        if (owned) return owned;
      }
      if (all.indexOf(jp) >= 0) return jp;
      // 習得リスト外でも move_list にあれば受理（技不具合の緊急登録の JSON 往復用）
      if (getMoveInfo(jp)) return jp;
      return "";
    }
    return jp;
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
    if (info) return info.type;
    // サードアタック「技+」は元技のタイプを使う
    if (/\+$/.test(moveName)) {
      const base = moveName.replace(/\++$/, "");
      const baseInfo = getMoveInfo(base);
      if (baseInfo) return baseInfo.type;
    }
    return null;
  }

  return {
    loadAll,
    getPokemonList,
    getPokemonByDexNo,
    getPokemonByName,
    searchPokemon,
    setSearchPriority,
    getMovesForPokemon,
    getRegisteredThird,
    isMegaPokemon,
    isThirdAttackName,
    searchMoves,
    getMoveInfo,
    getDefaultMoves,
    getTypeIconPath,
    getDisplayMoveName,
    getMoveTypeName,
    getPokemonEngName,
    getMoveEngName,
    getPokemonByEngName,
    formatMoveForJson,
    parseJsonMoveName,
    get moveList() {
      return moveList;
    },
    isReady() {
      return ready;
    },
  };
})();
