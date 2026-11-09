# WaveCanvas 介面術語表

介面翻譯的固定譯法。修改譯文時以這份表為準；要改譯法時，請先改這裡，再改 `app/locales/en.js` 與 `app/locales/ja.js` 中所有用到的地方。

English 與日本語目前都是**草稿**，由開發過程中先行翻譯，尚未經母語者校對。

## 運作方式

- 程式中的繁體中文原文就是訊息 ID；`app/locales/*.js` 以原文為鍵存放譯文。
- 介面上的固定文字由 `app/i18n-dom.js` 自動套用；含變數的文字用 `WaveCanvasI18n.t('…{name}…', { name })` 或 `WaveCanvasI18nDom.text()`。
- 缺少日文時先退回英文；英文也沒有時顯示原文，並由 `npm test`（`dev/tests/i18n.test.cjs`）列出。
- 畫布（`#stage`）、歌詞、曲名、專案名稱、檔名等使用者內容一律不翻譯。

## 固定譯法

| 繁體中文 | English | 日本語 | 備註 |
|---|---|---|---|
| 圖層 | Layer(s) | レイヤー | 左側清單 |
| 屬性 | Properties | プロパティ | 右側面板 |
| 預設組 | Preset | プリセット | 視覺設定 JSON |
| 模板 | Template | テンプレート | 首頁的 Circle／Square／Linear |
| 專案 | Project | プロジェクト | `.waveproj` |
| 偏好設定 | Preferences | 環境設定 | |
| 輸出影片 | Export video | 動画を書き出し | 「輸出」一律譯為 Export／書き出し |
| 片尾延長 | Tail | 末尾延長 | Export Tail；音樂結束後繼續輸出的秒數 |
| 歌詞結束時間 | Lyrics end time | 歌詞の終了時刻 | |
| 歌詞校時 | Lyric timing | 歌詞タイミング | 校時編輯器 |
| 主要歌詞／次要歌詞 | Primary / secondary lyrics | メイン歌詞／サブ歌詞 | |
| 歌曲資訊 | Song info | 曲情報 | 曲名與作者 |
| 頻譜 | Spectrum | スペクトラム | |
| 頻譜柱 | Bar(s) | バー | |
| 排列 | Arrangement | 配置 | 圓形／方形／直線 |
| 中心圖片 | Center image | 中央画像 | |
| 封面 | Cover | カバー | 直線模式 |
| 粒子 | Particles | パーティクル | |
| 低頻反應 | Bass reaction | 低音リアクション | |
| 背光 | Glow | グロー | 歌詞的發光效果 |
| 畫布 | Canvas | キャンバス | 1920×1080 輸出畫面 |
| 畫布像素 | canvas px | キャンバス px | |
| 不透明度 | Opacity | 不透明度 | |
| 門檻 | Threshold | しきい値 | |
| 偏移 | Offset | オフセット | 時間或位置 |
| 恢復預設值 | Restore defaults | 既定値に戻す | |
| 原廠預設 | Factory defaults | 初期設定 | |
| 第三方授權 | Third-party licenses | サードパーティのライセンス | |
| Desktop App | Desktop App | デスクトップアプリ | |

## 不翻譯

- 語言名稱：`繁體中文`、`English`、`日本語` 一律用該語言本身書寫。
- 格式與技術名詞：LRC、SRT、JSON、WAV、MP3、FLAC、PNG、JPG、WEBP、H.264、RPM、fps。
- 內建模板名稱 Circle、Square、Linear。
