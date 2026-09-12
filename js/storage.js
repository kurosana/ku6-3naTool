/**
 * localStorage スキーマ v2
 * - partySlots: 10スロット（JSONのみ）
 * - battleLogs: 最大50件
 * - inputHistory: 各フィールド最大3件
 */

const StorageService = (function () {
  const SCHEMA = "2";
  const KEYS = {
    schema: "teamSheet_schemaVersion",
    partySlots: "teamSheet_partySlots",
    battleLogs: "teamSheet_battleLogs",
    inputHistory: "teamSheet_inputHistory",
    engOutput: "teamSheet_engOutput",
    legacyHistory: "teamSheet_history",
    legacyHandle: "teamSheet_handleName",
    legacyTrainer: "teamSheet_trainerName",
    legacyFriend: "teamSheet_friendCode",
  };

  const PARTY_SLOT_COUNT = 10;
  const BATTLE_LOG_MAX = 50;
  const INPUT_HISTORY_MAX = 3;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function emptyInputHistory() {
    return { handleName: [], trainerName: [], friendCode: [] };
  }

  function pushUnique(arr, value, max) {
    const v = String(value || "").trim();
    if (!v) return arr;
    const next = [v].concat((arr || []).filter((x) => x !== v));
    return next.slice(0, max);
  }

  function migrateFromLegacy() {
    if (localStorage.getItem(KEYS.schema) === SCHEMA) return;

    const slots = new Array(PARTY_SLOT_COUNT).fill(null);
    const legacyHistory = readJson(KEYS.legacyHistory, []);
    if (Array.isArray(legacyHistory)) {
      legacyHistory.slice(0, 3).forEach((item, i) => {
        if (!item || !item.json) return;
        slots[i] = {
          name: "",
          at: item.at || Date.now(),
          json: item.json,
        };
      });
    }

    const inputHistory = emptyInputHistory();
    const h = localStorage.getItem(KEYS.legacyHandle);
    const t = localStorage.getItem(KEYS.legacyTrainer);
    const f = localStorage.getItem(KEYS.legacyFriend);
    if (h) inputHistory.handleName = pushUnique([], h, INPUT_HISTORY_MAX);
    if (t) inputHistory.trainerName = pushUnique([], t, INPUT_HISTORY_MAX);
    if (f) inputHistory.friendCode = pushUnique([], f, INPUT_HISTORY_MAX);

    writeJson(KEYS.partySlots, slots);
    writeJson(KEYS.battleLogs, []);
    writeJson(KEYS.inputHistory, inputHistory);

    localStorage.removeItem(KEYS.legacyHistory);
    localStorage.removeItem(KEYS.legacyHandle);
    localStorage.removeItem(KEYS.legacyTrainer);
    localStorage.removeItem(KEYS.legacyFriend);
    localStorage.setItem(KEYS.schema, SCHEMA);
  }

  function getPartySlots() {
    migrateFromLegacy();
    const arr = readJson(KEYS.partySlots, []);
    const slots = Array.isArray(arr) ? arr.slice(0, PARTY_SLOT_COUNT) : [];
    while (slots.length < PARTY_SLOT_COUNT) slots.push(null);
    return slots;
  }

  function setPartySlots(slots) {
    const next = Array.isArray(slots) ? slots.slice(0, PARTY_SLOT_COUNT) : [];
    while (next.length < PARTY_SLOT_COUNT) next.push(null);
    try {
      writeJson(KEYS.partySlots, next);
      return true;
    } catch (_) {
      return false;
    }
  }

  function setPartySlot(index, entry) {
    if (index < 0 || index >= PARTY_SLOT_COUNT) return false;
    const slots = getPartySlots();
    slots[index] = entry;
    return setPartySlots(slots);
  }

  function clearPartySlot(index) {
    return setPartySlot(index, null);
  }

  function reorderPartySlots(fromIndex, toIndex) {
    if (fromIndex === toIndex) return true;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= PARTY_SLOT_COUNT || toIndex >= PARTY_SLOT_COUNT) return false;
    const slots = getPartySlots();
    const [item] = slots.splice(fromIndex, 1);
    slots.splice(toIndex, 0, item);
    return setPartySlots(slots);
  }

  function renamePartySlot(index, name) {
    const slots = getPartySlots();
    const slot = slots[index];
    if (!slot) return false;
    slot.name = String(name || "").trim();
    return setPartySlot(index, slot);
  }

  function getBattleLogs() {
    migrateFromLegacy();
    const arr = readJson(KEYS.battleLogs, []);
    return Array.isArray(arr) ? arr.slice(0, BATTLE_LOG_MAX) : [];
  }

  function saveBattleLog(entry) {
    const logs = getBattleLogs();
    const idx = logs.findIndex((l) => l.id === entry.id);
    if (idx >= 0) logs[idx] = entry;
    else logs.unshift(entry);
    writeJson(KEYS.battleLogs, logs.slice(0, BATTLE_LOG_MAX));
    return true;
  }

  function deleteBattleLog(id) {
    const logs = getBattleLogs().filter((l) => l.id !== id);
    writeJson(KEYS.battleLogs, logs);
    return true;
  }

  function getInputHistory() {
    migrateFromLegacy();
    const h = readJson(KEYS.inputHistory, emptyInputHistory());
    return {
      handleName: Array.isArray(h.handleName) ? h.handleName.slice(0, INPUT_HISTORY_MAX) : [],
      trainerName: Array.isArray(h.trainerName) ? h.trainerName.slice(0, INPUT_HISTORY_MAX) : [],
      friendCode: Array.isArray(h.friendCode) ? h.friendCode.slice(0, INPUT_HISTORY_MAX) : [],
    };
  }

  function recordInputHistory(fields) {
    const h = getInputHistory();
    if (fields.handleName) h.handleName = pushUnique(h.handleName, fields.handleName, INPUT_HISTORY_MAX);
    if (fields.trainerName) h.trainerName = pushUnique(h.trainerName, fields.trainerName, INPUT_HISTORY_MAX);
    if (fields.friendCode) h.friendCode = pushUnique(h.friendCode, fields.friendCode, INPUT_HISTORY_MAX);
    writeJson(KEYS.inputHistory, h);
  }

  function getEngOutput() {
    return localStorage.getItem(KEYS.engOutput) === "1";
  }

  function setEngOutput(on) {
    localStorage.setItem(KEYS.engOutput, on ? "1" : "0");
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function exportBackup() {
    return {
      app: "Ku6-3naTool",
      schemaVersion: SCHEMA,
      exportedAt: Date.now(),
      partySlots: getPartySlots(),
      battleLogs: getBattleLogs(),
      inputHistory: getInputHistory(),
      engOutput: getEngOutput(),
    };
  }

  function importBackup(data) {
    if (!data || typeof data !== "object") {
      return { ok: false, error: "ファイルを読み込めませんでした" };
    }
    const hasSlots = Array.isArray(data.partySlots);
    const hasLogs = Array.isArray(data.battleLogs);
    if (data.app && data.app !== "Ku6-3naTool") {
      return { ok: false, error: "Ku6-3naToolのバックアップファイルではありません" };
    }
    if (!hasSlots && !hasLogs) {
      return { ok: false, error: "Ku6-3naToolのバックアップファイルではありません" };
    }
    if (hasSlots) setPartySlots(data.partySlots);
    if (hasLogs) writeJson(KEYS.battleLogs, data.battleLogs.slice(0, BATTLE_LOG_MAX));
    if (data.inputHistory && typeof data.inputHistory === "object") {
      const next = emptyInputHistory();
      if (Array.isArray(data.inputHistory.handleName)) next.handleName = data.inputHistory.handleName.slice(0, INPUT_HISTORY_MAX);
      if (Array.isArray(data.inputHistory.trainerName)) next.trainerName = data.inputHistory.trainerName.slice(0, INPUT_HISTORY_MAX);
      if (Array.isArray(data.inputHistory.friendCode)) next.friendCode = data.inputHistory.friendCode.slice(0, INPUT_HISTORY_MAX);
      writeJson(KEYS.inputHistory, next);
    }
    if (typeof data.engOutput === "boolean") setEngOutput(data.engOutput);
    localStorage.setItem(KEYS.schema, SCHEMA);
    return { ok: true };
  }

  return {
    PARTY_SLOT_COUNT,
    BATTLE_LOG_MAX,
    migrateFromLegacy,
    getPartySlots,
    setPartySlot,
    setPartySlots,
    clearPartySlot,
    reorderPartySlots,
    renamePartySlot,
    getBattleLogs,
    saveBattleLog,
    deleteBattleLog,
    getInputHistory,
    recordInputHistory,
    getEngOutput,
    setEngOutput,
    exportBackup,
    importBackup,
    newId,
  };
})();
