/**
 * チームシートツール 設定ファイル
 */

const CONFIG = {
  debugRecognition: 0,

  appVersion: "v3.0.5",
  appReleaseNotes: "UI全面改修・保存スロット10件・対戦ログ・メガ風デザイン",

  // ユーザー向け変更履歴（新しいバージョンは先頭に追記）
  appChangelog: [
    {
      version: "v3.0.5",
      changes: [
        "黄昏の旅路シーズンに合わせて技の優先度を変更しました。",
      ],
    },
    {
      version: "v3.0.4",
      changes: [
        "サードアタックに関する不具合を修正しました。",
      ],
    },
    {
      version: "v3.0.0",
      changes: [
        "トップから保存・対戦ログまでの画面をメガ風パステルUIに刷新しました。",
        "パーティを10件保存でき、並べ替え・削除・インポート／エクスポートができます。",
        "対戦ログを残せるようになりました。",
        "サイトの使い方ガイドと、Xでの共有を追加しました。",
        "出力画像はプレビューの長押し、または「画像保存」で 6-3sheet.png として保存できます。",
        "画面の横幅に合わせてパーティ入力の配置が変わるようにしました。",
        "バージョン情報ページを追加しました。",
      ],
    },
    {
      version: "v2.4.0",
      changes: [
        "メガシンカの表示に対応し、画像認識素材とポケモンデータを大きく追加しました。",
      ],
    },
    {
      version: "v2.3.4",
      changes: [
        "ポケモンのわざデータを修正しました。",
      ],
    },
    {
      version: "v2.3.2",
      changes: [
        "画像認識素材を追加し、ポケモンデータを更新しました。",
      ],
    },
    {
      version: "v2.3.1",
      changes: [
        "画像認識素材を追加し、jsonからの開始などに対応しました。",
      ],
    },
    {
      version: "v2.3.0",
      changes: [
        "画像認識の精度を改善しました。",
      ],
    },
    {
      version: "v2.2.0",
      changes: [
        "画像認識の処理を改善しました。",
      ],
    },
    {
      version: "v2.1.0",
      changes: [
        "お気に入りつき認識の扱いを見直し、素材を追加しました。",
      ],
    },
    {
      version: "v2.0.0",
      changes: [
        "お気に入りマーク付きポケモンの画像認識に対応しました。",
      ],
    },
    {
      version: "v1.4.6",
      changes: [
        "ポケモンのわざデータを更新しました。",
      ],
    },
    {
      version: "v1.4.5",
      changes: [
        "入力まわりの不具合を修正しました。",
      ],
    },
    {
      version: "v1.4.4",
      changes: [
        "空きスロットなどの表示を調整しました。",
      ],
    },
    {
      version: "v1.4.1",
      changes: [
        "過去のパーティを呼び出して作り直せるようにしました。",
      ],
    },
    {
      version: "v1.3.2",
      changes: [
        "ポケモンのわざデータを更新しました。",
      ],
    },
    {
      version: "v1.3.1",
      changes: [
        "画像認識素材を追加しました。",
      ],
    },
    {
      version: "v1.2.1",
      changes: [
        "英語で出力できるようになりました。",
      ],
    },
    {
      version: "v1.1.10",
      changes: [
        "出力テンプレートを更新し、ポケモンデータを修正しました。",
      ],
    },
    {
      version: "v1.1.0",
      changes: [
        "画像認識の開始まわりを改善しました。",
      ],
    },
    {
      version: "v1.0.1",
      changes: [
        "Android端末での画像認識位置合わせを改善しました。",
      ],
    },
    {
      version: "v1.0.0",
      changes: [
        "チームシートの作成と画像認識を公開しました。",
      ],
    },
  ],

  // ========== 画像認識 ==========
  imageMatchThreshold: 0.65,
  recognitionIgnoreBackground: 1,
  recognitionSearchTemplatePath: "Image/Match/Searching.png",
  recognitionSearchBarColor: "#e7f4e0",
  recognitionSearchBarTolerance: 25,
  recognitionZoneN: 180,
  recognitionZoneM: 65,
  recognitionZoneL: 207,
  recognitionZoneK: 155,
  recognitionRefHeight: 2556,
  recognitionRefWidth: 1179,
  recognitionAndroidTrianglePath: "Image/Match/Android_triangle.png",
  recognitionAndroidTriangleThreshold: 0.55,
  recognitionContentLeftPct: 0.06,
  recognitionContentWidthPct: 0.88,
  recognitionCpRightWeightPct: 0.3,
  recognitionCpRightWeight: 3.0,
  recognitionBgGrayMin: 248,
  recognitionUseConnectedComponent: 1,
  recognitionPokemonMinComponentRatio: 0.12,
  recognitionStarCornerTopPct: 0.22,
  recognitionStarCornerRightPct: 0.28,
  recognitionStarTopBandPct: 0.35,
  recognitionStarMaskTopBandPct: 0.22,
  recognitionStarMaskLeftPct: 0.55,
  recognitionStarComponentMaxSizeRatio: 0.5,
  recognitionStarPixelFracInComponent: 0.4,
  recognitionShadowCornerBottomPct: 0.25,
  recognitionShadowCornerLeftPct: 0.28,
  recognitionExcludeStarFromCP: 1,
  recognitionCpBBoxMaxWidthPct: 0.85,
  recognitionCpBBoxMaxHeightPct: 0.85,
  recognitionTemplateLoadConcurrency: 12,

  typeIconFolder: "Image/Type&shadow",

  outputWidth: 1748,
  outputHeight: 2480,
  templatePath: "Image/Template.png",

  outputEngPokemonNameSize: 57,
  outputEngMoveNameSize: 40,

  labelRecognitionHint: "※キャッシュがないと少し時間かかります",
  labelRecognitionHint2: "お気に入り対応しましたが認識精度は落ちます",
  labelHandleName: "ハンドルネーム",
  labelTrainerName: "トレーナーネーム",
  labelFriendCode: "フレンドコード",
  labelSelectPokemon: "ポケモン選択",
  labelRecognitionFailed: "画像認識失敗",
  labelClearAllMoves: "技を全消去",
  labelCp: "CP",
  labelShadow: "シャドウ",
  labelLight: "ライト",

  // 画像認識ページの説明（HTML可: <a> タグ使用可）
  scanHelpSections: [
    {
      title: "1. 全ポケモンには対応していません。",
      body: "画像認識用の素材は1つ1つ手作業で作成しているので、全ポケモンには対応できていません。\nまた、通常ポケモンとシャドウポケモンは全く別素材で管理しています。\n\nある程度メジャーなポケモンは対応しているつもりですが、要望があればクロサナ(<a href=\"https://x.com/kurosana309637\" target=\"_blank\" rel=\"noopener noreferrer\">@kurosana309637</a>)までご連絡ください。",
    },
    {
      title: "2. お気に入り以外のマークは非対応",
      body: "お気に入りマークだけは対応しましたが、それ以外の要素がボックス画面についているとそのポケモンは認識失敗します。\n-色違い\n-相棒リボン\n-ダイマックスマーク\n-24時間以内に捕獲した青い背景\n\nあと、白っぽいポケモンが背景と同化してしまって誤認知される不具合があります。\nガラルサニーゴがマリルリやたいようポワルンなどに化けると報告がありますが、これは技術限界なので許してください。",
    },
    {
      title: "3. 「検索」の文字を検知してます",
      body: "端末ごとの画面の大きさの違いに対応するために、\n画像認識プログラムはまず検索バーの「検索」の文字を検知してポケモンの場所を特定しています。\nこの文字が画像にないと全部認識失敗してしまいます。",
    },
    {
      title: "4. トリミングしないでください。",
      body: "端末ごとの画面の大きさの違いに対応するために、\n画像認識プログラムは画像の縦横比からポケモンの位置を割り出しています。\nそのため、以下のような要素があると正常に縦横比を認識できず失敗してしまいます。\n-トリミングして画像の一部分だけを読み込ませている\n-タグに12体以上含まれているなどで、少し上にスクロールしてしまっている\n\n読み込む画像は必ずトリミングなしで、スクロールなどもせずタグの画面を開いたままで使ってください。",
    },
  ],

  // 使い方ガイド（スクリーンショットは Image/Guide/ に配置）
  guideSections: [
    {
      num: "01",
      title: "6-3シートを作成",
      lead: "トップの「6-3シート作成」からメニューへ進み、「新しく作成」でパーティ入力画面を開きます。",
      image: "Image/Guide/01-menu.png",
      imageAlt: "メニュー画面",
    },
    {
      num: "02",
      title: "ポケモンを入力",
      lead: "「ポケモン選択」から名前で探して6匹を入れ、CP・シャドウ／ライト・わざを整えます。ひとつずつ手で入力するのが基本です。",
      image: "Image/Guide/02-sheet.png",
      imageAlt: "パーティ入力画面",
    },
    {
      num: "03",
      title: "画像認識で入力",
      lead: "タグのスクリーンショットがあれば、「画像認識で入力」からまとめて読み込めます。追加の時短手段です。",
      image: "Image/Guide/03-scan.png",
      imageAlt: "画像認識画面",
    },
    {
      num: "04",
      title: "画像を出力",
      lead: "入力が終わったら「画像出力」。プレビューが表示されるので長押しで保存できます。",
      image: "Image/Guide/04-output.png",
      imageAlt: "画像出力プレビュー",
    },
    {
      num: "05",
      title: "データを保存・呼び出し",
      lead: "「保存データから作成」で10スロットにパーティを保存・復元できます。",
      image: "Image/Guide/05-slots.png",
      imageAlt: "保存スロット画面",
    },
    {
      num: "06",
      title: "対戦ログを残そう",
      lead: "「対戦ログ作成」で対戦相手とパーティを50件まで記録できます。",
      image: "Image/Guide/06-log.png",
      imageAlt: "対戦ログ画面",
    },
  ],
};

const getBasePath = () => "./";
