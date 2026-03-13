/**
 * チームシートツール 設定ファイル
 * 説明文や閾値など、運用で変更しやすい項目をここにまとめています。
 * 必要に応じてこのファイルだけ編集してください。
 */

const CONFIG = {
  // ========== デバッグ ==========
  // 1 にすると画像認識のデバッグモードがON。読み込んだ画像の切り取り範囲・判定結果をオーバーレイで表示します。
  debugRecognition: 1,

  // ========== エントランス画面の説明文 ==========
  // 画像読み込みについての説明（「画像を読み込む」ボタンの下に表示）
  imageLoadExplanation: "6匹のポケモンだけが映ったタグのスクリーンショットをトリミングせず読み込ませてください",

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
  recognitionZoneN: 180,
  recognitionZoneM: 62,
  recognitionZoneL: 210,
  recognitionZoneK: 155,
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

  // ========== 表示用ラベル（必要なら変更可） ==========
  labelHandleName: "ハンドルネーム",
  labelTrainerName: "トレーナーネーム",
  labelFriendCode: "フレンドコード",
  labelSelectPokemon: "ポケモン選択",
  labelRecognitionFailed: "画像認識失敗",
  labelCp: "CP",
  labelShadow: "シャドウ",
  labelLight: "ライト",
};

// GitHub Pages などで相対パスで動くように、ベースパスを取得
const getBasePath = () => {
  const path = (typeof window !== "undefined" && window.location?.pathname) || "";
  if (path.endsWith(".html") || path.endsWith("/")) return path.split("/").slice(0, -1).join("/") + "/";
  return path ? path + "/" : "./";
};
