# カメラAI立ち位置クイズ

カメラ映像から登録した参加者を検出し、画面上の回答エリアへ移動して答えるブラウザ向けクイズアプリです。

## 主な機能

- タイトル画面
- 難易度選択
  - 子ども向け
  - 大人向け
  - すべて
- JSON問題ファイルのローカル読み込み
- `AIクイズ問題マスタ`形式のJSONを既存の出題形式へ自動変換
- 問題文と選択肢の日本語自動読み上げ
- 読み上げ終了後に回答時間を開始
- 「もう一度読み上げる」操作
- 問題ごとの画像表示・MP3音声再生（従来形式との互換）
- 2択・3択以上の回答エリアを色分け
- 正解後に補足コメントを表示
- 時間確定／スペースキー確定の2種類の回答方式

## 起動方法

```bash
git clone https://github.com/Shimamotogit/ai-quiz.git
cd ai-quiz
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
7. 問題と選択肢が自動で読み上げられます。
8. 読み上げが終了すると回答時間が始まります。

## 既定の問題データ

`questions.json`には、提供された `AIクイズ問題マスタ`（50問）をアプリ用形式へ変換した問題を収録しています。

元データの内容を推測で修正しない方針のため、回答を安全に特定できない次の5問は既定の出題対象から除外しています。

- No.21〜24: 回答が未設定
- No.26: 〇✕形式に対して回答が `A` になっており、選択肢へ安全に対応付けできない

そのため、既定の出題可能問題数は45問です。元JSONに含まれる警告は `questions.json` の `sourceMeta` に残しています。

## AIクイズ問題マスタ形式のJSON

画面のJSON選択から、次のようなマスタ形式をそのまま読み込めます。

```json
{
  "schema_version": "1.0",
  "title": "AIクイズ問題マスタ",
  "questions": [
    {
      "id": "Q001",
      "no": 1,
      "target": {
        "children": true,
        "adults": false,
        "employees": false
      },
      "adopted": true,
      "question": "AIは、人間が考えて答えたように見える文章を作れる。",
      "choice_type": "true_false",
      "choices": ["〇", "✕"],
      "answer": "〇",
      "supplemental_comment": "AIは、人間が書いたように見える文章を作ることができます。"
    }
  ]
}
```

変換時は次のように扱います。

- `question` → 問題文
- `choices` → 選択肢
- `answer` → 正解位置
- `target.children` → 子ども向け
- `target.adults` / `target.employees` → 大人向け
- `supplemental_comment` → 採点後の解説
- `adopted: false` → 出題対象外
- 回答未設定・回答形式不整合 → 推測せず出題対象外

## 従来のJSON形式

従来形式も引き続き利用できます。

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

### 従来形式で追加できる項目

- `difficulty`：`kids`、`adults`、`all`
- `image`：同一サイト内の相対パス。`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.svg`
- `imageAlt`：画像の説明
- `audio`：同一サイト内のMP3相対パス。`.mp3`
- `explanation`：採点後に表示する補足コメント

## 問題読み上げと制限時間

問題表示時にブラウザの Web Speech API を使い、日本語で問題文と選択肢を自動読み上げします。

- 〇は「まる」、✕は「ばつ」と読み上げます。
- 3択以上は A / B / C と選択肢本文を読み上げます。
- 読み上げ中は回答用の時計を停止します。
- **時間確定モードの滞在時間は、読み上げ終了後から進みます。**
- **スペースキーモードも、読み上げ中はスペースによる回答カウントダウンを開始できません。**
- 読み上げ終了後に回答受付を開始します。
- 「もう一度読み上げる」を押した場合も、再読み上げ中は回答用時計を停止します。
- 読み上げ非対応ブラウザや読み上げエラー時は、読み上げなしで回答受付を開始します。

ブラウザやOSによって利用される日本語音声は異なります。

## MP3音声との互換

従来形式の問題に `audio` が設定されている場合は、これまでどおり問題画面にMP3プレイヤーを表示できます。画像やMP3が存在しない場合は、エラーメッセージを表示してクイズを継続します。

## ローカル処理とセキュリティ

- 選択したJSONはブラウザの `File` API で読み込みます。
- JSONはブラウザ内で検証し、IndexedDBに保存します。
- JSONやカメラ映像を外部サーバーへ送信する処理は追加していません。
- 問題読み上げはブラウザ標準の音声合成機能を使用します。
- JSON内の文字列は `textContent` で表示し、HTMLとして実行しません。
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
├── question-master-adapter.js
├── question-speech.js
├── quiz-media.js
├── answer-timer-feedback.js
├── detector-compat.js
├── app.js
├── questions.json
├── images/
├── tests/
├── _headers
└── README.md
```

## 注意事項

- Web Speech API の音声品質・利用可否はブラウザとOSに依存します。
- MP3や画像を使う場合は、JSONで指定した相対パスにファイルを配置してください。
- 低性能端末では、人物検出・画像表示・音声処理を同時に行うと動作が重くなる場合があります。
