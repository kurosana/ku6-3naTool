/**
 * チームシートツール 設定ファイル
 * 説明文や閾値など、運用で変更しやすい項目をここにまとめています。
 * 必要に応じてこのファイルだけ編集してください。
 */

const CONFIG = {
  // ========== デバッグ ==========
  // 1 にすると画像認識のデバッグモードがON。読み込んだ画像の切り取り範囲・判定結果をオーバーレイで表示します。
  debugRecognition: 0,

  // ========== エントランス画面の説明文 ==========
  // 画像読み込みについての説明（「画像を読み込む」ボタンの下に表示）
  imageLoadExplanation: "6匹の「お気に入りでない」ポケモンだけが映ったタグのスクリーンショットをトリミングせず読み込ませてください",

  // ========== 画像認識 ==========
  // テンプレート画像との一致度の閾値（0～1）。これより類似度が高いとマッチと判定
  imageMatchThreshold: 0.65,
  // 背景を相関から除外する（テンプレートの透明部分のみ）
  recognitionIgnoreBackground: 1,
  // ========== ゾーン基準の画像認識（検索バー検出→基準高さ→ゾーン分割） ==========
  recognitionSearchTemplatePath: "Image/Match/Searching.png",
  recognitionSearchBarColor: "#e7f4e0",
  recognitionSearchBarTolerance: 25,
  // 基準高さ(refY)の下から: nピクセル空けてCP1, mピクセル高さCP1, lピクセル高さポケモン1, kピクセル空けてCP2。2段目も同様
  // ※ピクセル値は recognitionRefHeight のスクリーン高さを基準にした値。異なる解像度でも自動スケールされる
  recognitionZoneN: 180,
  recognitionZoneM: 65,
  recognitionZoneL: 207,
  recognitionZoneK: 155,
  // ゾーンパラメータの基準スクリーン高さ（ピクセル）。読み込み画像の高さに合わせて自動スケールされる
  recognitionRefHeight: 2556,
  // ゾーンパラメータの基準スクリーン横幅（ピクセル）。縦スケール後の横幅と比較して横方向のスケールも計算する
  recognitionRefWidth: 1179,
  // Android ナビゲーションバー三角アイコンの検知テンプレートパス
  recognitionAndroidTrianglePath: "Image/Match/Android_triangle.png",
  // Android 三角検知時のテンプレートマッチング閾値
  recognitionAndroidTriangleThreshold: 0.55,
  // 左右の濃い背景を除く。コンテンツ幅 = 画像幅 * contentWidthPct、左端 = 画像幅 * contentLeftPct
  recognitionContentLeftPct: 0.06,
  recognitionContentWidthPct: 0.88,
  // CP認識の右側重み付け（一の位の判別精度向上）
  // 右から recognitionCpRightWeightPct % のピクセルを recognitionCpRightWeight 倍の重みで判定
  recognitionCpRightWeightPct: 0.3,
  recognitionCpRightWeight: 3.0,
  // 背景とみなす色（明るいグラデーション・検索欄）
  recognitionBgGrayMin: 248,

  // ========== パス設定（通常は変更不要） ==========
  // タイプアイコン画像のフォルダ（Data/Type.csv のパスと実フォルダが異なる場合にここを変更）
  typeIconFolder: "Image/Type&shadow",

  // ========== シート出力 ==========
  outputWidth: 1748,
  outputHeight: 2480,
  templatePath: "Image/Template.png",

  // ========== バージョン表記 ==========
  appVersion: "v1.4.5",
  // アップデート情報（メイン画面左上・バージョンの下に表示。空文字 "" にすると非表示）
  appReleaseNotes: "過去に出力したパーティを呼び出して編集→再出力できるようにしました！",

  // ========== 英語出力フォントサイズ ==========
  outputEngPokemonNameSize: 57,
  outputEngMoveNameSize: 40,

  // ========== 表示用ラベル（必要なら変更可） ==========
  labelRecognitionHint: "※キャッシュがないと少し時間かかります",
  labelRecognitionHint2: "お気に入りマーク(★)で認識精度落ちます",
  labelSheetNote1: "※画像認識は一部ポケモンしか実装されていません（素材提供求）",
  labelSheetNote2: "→色違い・相棒・お気に入り・24時間以内捕獲の背景あると認識不可(現状)",
  labelSheetNote3: "→認識されなかった場合は「画像認識失敗」をタッチして手動でお願いします",
  labelHandleName: "ハンドルネーム",
  labelTrainerName: "トレーナーネーム",
  labelFriendCode: "フレンドコード",
  labelSelectPokemon: "ポケモン選択",
  labelRecognitionFailed: "画像認識失敗",
  labelCp: "CP",
  labelShadow: "シャドウ",
  labelLight: "ライト",
};

// index.html からの相対パスを返す（ローカル・GitHub Pages 両方対応）
// fetch / img.src の相対パスはページ（index.html）の URL を起点に解決されるため
// "./" を返すことで環境によらず正しく動作する
const getBasePath = () => "./";
