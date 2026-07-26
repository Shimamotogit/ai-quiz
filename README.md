# カメラAI立ち位置クイズ

カメラ映像から登録した参加者を検出し、画面上の回答エリアへ移動して答えるブラウザ向けクイズアプリです。

## 今回追加した機能

- タイトル画面
- 難易度選択画面
  - 子ども向け
  - 大人向け
  - すべて
- アップロードされた`問題一覧.md`を組み込み、サンプル問題をAIリテラシー問題へ更新
- 問題ごとの画像表示
- 問題ごとのMP3音声再生
- 画像ファイルや音声ファイルが存在しない場合もクイズを継続
- 2択・3択以上の回答エリアを色分け
- 正解後に補足コメントを表示
- JSONアップロード時の検証を強化

## 起動方法

```bash
git clone https://github.com/Shimamotogit/person-coordinate-detection.git
cd person-coordinate-detection
git switch main
git pull origin main
python -m http.server 8080
```

ブラウザで次を開きます。

```text
http://localhost:8080
```

`python`が使えない場合は次を使います。

```bash
python3 -m http.server 8080
```

## ゲームの流れ

1. タイトル画面で「スタート」を押します。
2. 難易度を選択します。
3. 必要に応じてJSONファイルを選択します。
4. 出題数と最大点を設定します。
5. カメラと参加者を設定します。
6. 回答方法を選び、クイズを開始します。

## 問題データ

同梱の`questions.json`には、提供された`問題一覧.md`を元にした問題を組み込んでいます。

元のMarkdownも`問題一覧.md`としてリポジトリへ保存しています。回答欄が空の行は、クイズとして採点できないためサンプルJSONからは除外しています。

## JSON形式

```json
{
  "settings": {
    "holdDurationMs": 1200,
    "resultDisplayMs": 1300,
    "spaceCountdownSeconds": 3,
    "defaultQuestionCount": 10,
    "defaultMaxScore": 1000
  },
  "questions": [
    {
      "id": "sample",
      "text": "この画像は生成AIによって作成されたものである",
      "choices": ["〇", "✕"],
      "correctIndex": 0,
      "difficulty": ["kids", "adults"],
      "image": "images/sample-ai-photo-question.svg",
      "imageAlt": "生成AI判定クイズ用のサンプル画像",
      "audio": "audio/sample-question.mp3",
      "explanation": "採点後に表示する補足コメント"
    }
  ]
}
```

### 追加できる項目

- `difficulty`：`kids`、`adults`、`all`
- `image`：同一サイト内の相対パス。`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.svg`
- `imageAlt`：画像の説明
- `audio`：同一サイト内のMP3相対パス。`.mp3`
- `explanation`：採点後に表示する補足コメント

画像や音声ファイルが存在しない場合は、エラーメッセージを表示してクイズを継続します。

## ローカル処理とセキュリティ

- 選択したJSONはブラウザの`File` APIで読み込みます。
- JSONはブラウザ内で検証し、IndexedDBに保存します。
- JSON、画像、MP3、カメラ映像をサーバーへ送信する処理は追加していません。
- JSON内の文字列は`textContent`で表示し、HTMLとして実行しません。
- 画像とMP3は同一サイト内の相対パスのみ許可します。
- Content Security Policyで読み込み先を制限しています。

## ファイル構成

```text
.
├── index.html
├── styles.css
├── feature-ui.css
├── question-source.css
├── main.js
├── launch-flow.js
├── difficulty-filter.js
├── question-source.js
├── quiz-media.js
├── detector-compat.js
├── app.js
├── questions.json
├── 問題一覧.md
├── images/
│   └── sample-ai-photo-question.svg
├── _headers
└── README.md
```

## 注意事項

- MP3や画像を使う場合は、JSONで指定した相対パスにファイルを配置してください。
- ブラウザの自動再生制限を避けるため、MP3は問題画面のプレイヤーから再生します。
- 低性能端末では、人物検出と画像表示を同時に行うと動作が重くなる場合があります。
