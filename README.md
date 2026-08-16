# カメラAI立ち位置クイズ

カメラ映像から登録した参加者を検出し、画面上の回答エリアへ移動して答えるブラウザ向けクイズアプリです。

> **音声クレジット：VOICEVOX:ずんだもん**
>
> `音声データ_MP3/` 以下の MP3 は、リポジトリ管理者の申告に基づき、すべて VOICEVOX:ずんだもん で生成された音声です。音声の利用・複製・再配布等には VOICEVOX およびずんだもん音源の公式規約が適用されます。詳細は [`AUDIO_LICENSE.md`](AUDIO_LICENSE.md) を確認してください。

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

1. タイトル画面で「クイズをはじめる」を押します。
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

従来形式も引き続き利用できます。設定を省略した場合、回答確定時間は10秒、最大点数は100点が既定です。有効な値を明示した場合は、その値を優先します。

```json
{
  "settings": {
    "holdDurationMs": 10000,
    "resultDisplayMs": 1300,
    "spaceCountdownSeconds": 3,
    "defaultQuestionCount": 10,
    "defaultMaxScore": 100
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
      "explanationAudio": "audio/sample-explanation.mp3",
      "explanation": "採点後に表示する補足コメント"
    }
  ]
}
```

### 従来形式で追加できる項目

- `difficulty`：`kids`、`adults`、`all`
- `image`：同一サイト内の相対パス。`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.svg`
- `imageAlt`：画像の説明
- `audio`：問題読み上げに使う同一サイト内のMP3相対パス。`.mp3`
- `explanationAudio`：採点後の解説に使う同一サイト内のMP3相対パス。`.mp3`
- `explanation`：採点後に表示する補足コメント

## 問題読み上げと制限時間

問題表示時に、用意済みの MP3 がある場合はその音声を優先し、利用できない場合はブラウザの Web Speech API にフォールバックして日本語で問題文と選択肢を読み上げます。

- 〇は「まる」、✕は「ばつ」と読み上げます。
- 3択以上は A / B / C と選択肢本文を読み上げます。
- 読み上げ中は回答用の時計を停止します。
- **時間確定モードの滞在時間は、読み上げ終了後から進みます。**
- **スペースキーモードも、読み上げ中はスペースによる回答カウントダウンを開始できません。**
- 読み上げ終了後に回答受付を開始します。
- 「もう一度読み上げる」を押した場合も、再読み上げ中は回答用時計を停止します。
- MP3が存在しない場合や再生できない場合は、ブラウザ標準の音声合成を利用することがあります。

ブラウザやOSによってフォールバック時に利用される日本語音声は異なります。

## MP3音声との互換

組み込み問題の問題音声は `音声データ_MP3/02.問題/`、採点後の補足説明音声は `音声データ_MP3/03.問題_補足説明/`、開始・回答結果・終了などのシステム音声は `音声データ_MP3/01.システム/` を利用します。

ローカルJSONでは、問題ごとに `audio` または `explanationAudio` が明示されている場合だけ、その同一サイト内MP3を利用します。ローカル問題のIDが `Q001` のような組み込み問題と同じ形式でも、組み込み連番MP3へ自動対応はしません。音声が明示されていない場合はブラウザ読み上げへフォールバックします。

## VOICEVOX:ずんだもん 音声の利用条件

このアプリで配布・再生する `音声データ_MP3/` 以下の MP3 は、リポジトリ管理者の申告に基づき、すべて **VOICEVOX:ずんだもん** で生成されています。

利用時のクレジットは次のとおりです。

> **VOICEVOX:ずんだもん**

音声については、コードや他の素材と同じ条件で自由利用できるものとして扱わないでください。音声を利用、複製、再配布、改変、別アプリへ組み込む場合は、以下の最新公式規約に従う必要があります。

- VOICEVOX ソフトウェア利用規約: https://voicevox.hiroshiba.jp/term/
- ずんだもん音源利用規約: https://zunko.jp/con_ongen_kiyaku.html
- VOICEVOX Q&A: https://voicevox.hiroshiba.jp/qa/

VOICEVOX の規約では、生成音声を他者に利用させる場合、その利用者にも適用条件の遵守を求める必要があります。そのため、音声をこのリポジトリから再配布する場合も、クレジットと規約案内を保持してください。

より詳しい扱い、禁止事項の概要、キャラクター画像等を追加する場合の注意は [`AUDIO_LICENSE.md`](AUDIO_LICENSE.md) を参照してください。今回提供された音声ファイルは [`音声データ_MP3/SHA256SUMS.txt`](音声データ_MP3/SHA256SUMS.txt) で同一性を確認できます。

## ローカル処理とセキュリティ

- 選択したJSONはブラウザの `File` API で読み込みます。
- JSONはブラウザ内で検証し、IndexedDBに保存します。
- JSONやカメラ映像を外部サーバーへ送信する処理は追加していません。
- 問題音声は同一サイト内のMP3を優先し、必要に応じてブラウザ標準の音声合成へフォールバックします。
- JSON内の文字列は `textContent` で表示し、HTMLとして実行しません。
- 画像とMP3は同一サイト内の相対パスのみ許可します。
- Content Security Policyで読み込み先を制限しています。

## ファイル構成

```text
.
├── AUDIO_LICENSE.md
├── index.html
├── styles.css
├── feature-ui.css
├── question-source.css
├── main.js
├── voicevox-credit.js
├── launch-flow.js
├── difficulty-filter.js
├── question-source.js
├── question-master-adapter.js
├── question-speech.js
├── quiz-media.js
├── answer-timer-feedback.js
├── answer-visual-state.js
├── quiz-defaults.js
├── quiz-presentation.js
├── quiz-presentation.css
├── quiz-show-ui.js
├── navigation-priority.js
├── navigation-priority.css
├── system-audio-flow.js
├── system-audio-alias.js
├── detector-compat.js
├── app.js
├── questions.json
├── 音声データ_MP3/
│   ├── README.md
│   ├── SHA256SUMS.txt
│   ├── 01.システム/
│   ├── 02.問題/
│   └── 03.問題_補足説明/
├── images/
├── tests/
├── _headers
└── README.md
```

## 注意事項

- VOICEVOX・ずんだもん関連の規約は将来変更される可能性があります。公開、再配布、商用利用等の前に必ず公式規約の最新版を確認してください。
- ずんだもんのイラスト、立ち絵、3Dモデル等を追加する場合は、音源規約とは別にキャラクター利用ガイドライン等の確認が必要です。
- Web Speech API の音声品質・利用可否はブラウザとOSに依存します。
- MP3や画像を追加する場合は、JSONまたはアプリが参照する相対パスにファイルを配置してください。
- 低性能端末では、人物検出・画像表示・音声処理を同時に行うと動作が重くなる場合があります。
