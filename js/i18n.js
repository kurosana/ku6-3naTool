/**
 * 画面文言の英語切り替え。保存データやシート生成の中身は触らない。
 */
const I18n = (function () {
  const KEY = "teamSheet_uiEnglish";
  let english = false;

  const EN = {
    makeSheet: "Make a 6-3 sheet",
    howTo: "How to use",
    howToScroll: "Scroll to how to use",
    contact: 'Bugs and feedback: Kurosana (X:<a href="https://x.com/kurosana309637" target="_blank" rel="noopener noreferrer">@kurosana309637</a>)',
    back: "Back",
    scanQr: "Scan QR",
    menu: "Menu",
    fromSaved: "From saved",
    newSheet: "New sheet",
    battleLog: "Battle log",
    shareX: "Share on X",
    exportImage: "Export image",
    handle: "Handle name",
    trainer: "Trainer name",
    friend: "Friend code",
    recall: "Recall",
    fillScan: "Fill from screenshot",
    outputJa: "Output in Japanese",
    copyJson: "Copy JSON",
    clearMoves: "Clear moves",
    moveBug: "Move bug",
    scan: "Scan",
    scanLead: "Load a screenshot of a 6-Pokémon party tag, like the one on the right.",
    scanExample: "Enlarge the sample",
    scanExampleAlt: "Sample of a 6-Pokémon party tag",
    loadImage: "Load image",
    saved: "Saved data",
    export: "Export",
    import: "Import",
    cacheNote: "Saved data is stored in this browser's cache.<br>If the cache is cleared, the data is gone. Use Import and Export at the top right to keep a backup.",
    logLimit: "Up to the latest 50 are kept.",
    newLog: "New log",
    save: "Save",
    opponent: "Opponent name",
    close: "Close",
    showQr: "Show QR",
    longPress: "Long-press the image to save it",
    saveSlot: "Save to slot",
    saveImage: "Save image",
    printQr: "QR for printing",
    chooseSlot: "Choose a slot",
    overwriteAsk: "Overwrite this slot?",
    partyName: "Party name",
    saveChanges: "Save changes?",
    dontSave: "Don't save",
    jsonFailTitle: "Could not read the JSON",
    jsonFailBody: "No valid party JSON was found on the clipboard.",
    selectPokemon: "Select Pokémon",
    scanFailed: "Scan failed",
    allMoves: "All moves",
    shadow: "Shadow",
    light: "Purified",
    emptySlot: "Empty slot",
    searchPokemon: "Search by Pokémon name",
    searchHint: "Pokémon from your saved parties and battle logs are listed first.",
    searchMove: "Search by move name",
    qrFit: "Fit the whole QR inside the white frame.",
    qrStarting: "Starting the camera",
    qrSheetAlt: "Party sheet from the QR",
    qrCheckMoves: "Check that the moves are correct!",
    cancel: "Cancel",
    print: "Print",
    saveParty: "Save changes to this party?",
    replaceData: "Replace the saved data on this device?",
    delete: "Delete",
    rename: "Rename",
    reorder: "Reorder",
    clearSlot: "Clear this slot?",
    noLogs: "No battle logs",
    deleteLog: "Delete this battle log?",
    saveLogAsk: "Save changes to this battle log?",
    noHistory: "No history",
    qrReadText: "Read: ",
    qrFocus: "Focus ",
    qrFocusUnknown: "unknown",
    qrFocusCont: "continuous",
    qrFocusLocked: "locked",
    qrScanning: "Scanning",
    qrEmpty: "(empty)",
    qrBadFormat: "A QR was read, but it is not a code from this app",
    qrMaking: "Making the sheet",
    qrMakeFail: "Could not make the sheet",
    qrCameraFail: "Could not start the camera",
    qrCameraNo: "Camera unavailable",
    qrPrintTitle: "Print party sheet",
    qrNote: "On another device, open Scan QR and point the camera at this code.",
    qrAlt: "QR for the party on screen",
    qrBuildFail: "Could not make a QR",
    copied: "Copied",
    copyFail: "Copy failed",
    shareText: "Making a 6-3 sheet with Ku6-3naTool\nhttps://kurosana.github.io/ku6-3naTool/",
    ifScanFails: "If it does not work",
  };

  function isEnglish() {
    return english;
  }

  function load() {
    try {
      english = localStorage.getItem(KEY) === "1";
    } catch (_) {
      english = false;
    }
  }

  function setEnglish(on) {
    english = !!on;
    try {
      localStorage.setItem(KEY, english ? "1" : "0");
    } catch (_) {}
  }

  function text(key, ja) {
    if (!english || EN[key] == null) return ja;
    return EN[key];
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      if (el.dataset.i18nJa == null) el.dataset.i18nJa = el.textContent;
      const key = el.getAttribute("data-i18n");
      el.textContent = english && EN[key] != null ? EN[key] : el.dataset.i18nJa;
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      if (el.dataset.i18nJaHtml == null) el.dataset.i18nJaHtml = el.innerHTML;
      const key = el.getAttribute("data-i18n-html");
      el.innerHTML = english && EN[key] != null ? EN[key] : el.dataset.i18nJaHtml;
    });
    scope.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      if (el.dataset.i18nJaPh == null) el.dataset.i18nJaPh = el.getAttribute("placeholder") || "";
      const key = el.getAttribute("data-i18n-ph");
      el.setAttribute("placeholder", english && EN[key] != null ? EN[key] : el.dataset.i18nJaPh);
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      if (el.dataset.i18nJaAria == null) el.dataset.i18nJaAria = el.getAttribute("aria-label") || "";
      const key = el.getAttribute("data-i18n-aria");
      el.setAttribute("aria-label", english && EN[key] != null ? EN[key] : el.dataset.i18nJaAria);
    });
    scope.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      if (el.dataset.i18nJaAlt == null) el.dataset.i18nJaAlt = el.getAttribute("alt") || "";
      const key = el.getAttribute("data-i18n-alt");
      el.setAttribute("alt", english && EN[key] != null ? EN[key] : el.dataset.i18nJaAlt);
    });
    document.documentElement.classList.toggle("lang-en", english);
    document.documentElement.lang = english ? "en" : "ja";
    const btn = document.getElementById("btn-lang-en");
    if (btn) btn.setAttribute("aria-pressed", english ? "true" : "false");
  }

  function guideSections() {
    return [
      {
        num: "01",
        title: "Make a 6-3 sheet",
        lead: "From Make a 6-3 sheet on the top page, open the menu, then New sheet.",
        image: "Image/Guide/en/01-menu.png",
        imageAlt: "Menu",
      },
      {
        num: "02",
        title: "Enter Pokémon",
        lead: "Use Select Pokémon to search by name and add six. Then set CP, Shadow or Purified, and moves. Typing them in is the usual way.",
        image: "Image/Guide/en/02-sheet.png",
        imageAlt: "Party form",
      },
      {
        num: "03",
        title: "Fill from a screenshot",
        lead: "If you have a tag screenshot, Fill from screenshot can read the party at once. It is an extra shortcut.",
        image: "Image/Guide/en/03-scan.png",
        imageAlt: "Scan screen",
      },
      {
        num: "04",
        title: "Export the image",
        lead: "When you are done, tap Export image. Long-press the preview to save it.",
        image: "Image/Guide/en/04-output.png",
        imageAlt: "Image preview",
      },
      {
        num: "05",
        title: "Save and reload",
        lead: "From saved keeps up to 10 parties, and you can open them again.",
        image: "Image/Guide/en/05-slots.png",
        imageAlt: "Saved slots",
      },
      {
        num: "06",
        title: "Keep a battle log",
        lead: "Battle log records the opponent and the party, up to 50.",
        image: "Image/Guide/en/06-log.png",
        imageAlt: "Battle log",
      },
    ];
  }

  function scanHelpSections() {
    return [
      {
        title: "1. Not every Pokémon is supported.",
        body: "The recognition images are made by hand, so not every Pokémon is covered.\nNormal and Shadow Pokémon use completely different images.\n\nCommon Pokémon should be covered. If you need one, contact Kurosana (<a href=\"https://x.com/kurosana309637\" target=\"_blank\" rel=\"noopener noreferrer\">@kurosana309637</a>).",
      },
      {
        title: "2. Marks other than Favorite are not supported",
        body: "Favorite is supported. Any other mark on the box screen makes that Pokémon fail.\n- Shiny\n- Buddy ribbon\n- Dynamax mark\n- Blue background from a catch in the last 24 hours\n\nPale Pokémon can blend into the background and be misread.\nGalarian Corsola being read as Azumarill or Sunny Castform has been reported. That is a technical limit.",
      },
      {
        title: "3. The word 「検索」 is what gets detected",
        body: "To handle different screen sizes, the recognizer first finds the word 「検索」 on the search bar and uses it to locate the Pokémon.\nIf that word is not in the image, everything fails.",
      },
      {
        title: "4. Do not crop the image.",
        body: "To handle different screen sizes, the recognizer uses the image's aspect ratio to find the Pokémon.\nThese make that fail:\n- A cropped image\n- Scrolling up because the tag has 12 or more Pokémon\n\nUse an uncropped screenshot of the tag screen, without scrolling.",
      },
    ];
  }

  load();
  const api = {
    isEnglish,
    setEnglish,
    text,
    apply,
    guideSections,
    scanHelpSections,
  };
  window.I18n = api;
  return api;
})();
