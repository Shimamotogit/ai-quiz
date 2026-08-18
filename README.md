# カメラAI立ち位置クイズ

カメラ映像から登録した参加者を検出し、画面上の回答エリアへ移動して答えるブラウザ向けクイズアプリです。ビルド工程はなく、リポジトリをそのまま静的Webサーバーで配信できます。

> **音声クレジット：VOICEVOX:ずんだもん**
>
> `音声データ_MP3/` 以下の MP3 は、リポジトリ管理者の申告に基づき、すべて VOICEVOX:ずんだもん で生成された音声です。詳細は [`docs/AUDIO_LICENSE.md`](docs/AUDIO_LICENSE.md) を確認してください。

## 主な機能

- タイトル画面、難易度選択、問題設定、カメラ・参加者設定
- 子ども向け問題のひらがな表示切り替え
- JSON問題ファイルのローカル読み込み
- カメラ映像による参加者検出と立ち位置回答
- 時間確定／スペースキー確定の2種類の回答方式
- 問題・解説・システム音声のMP3再生とブラウザ読み上げフォールバック
- 問題画像、説明画像、全画面表示
- 採点、解説、最終スコア表示

## 起動方法

### Pythonの簡易HTTPサーバー

```bash
git clone https://github.com/Shimamotogit/ai-quiz.git
cd ai-quiz
python -m http.server 8080
```

ブラウザで `http://localhost:8080` を開きます。`python` コマンドがない環境では `python3 -m http.server 8080` を使用してください。

### nginx

ビルドやファイル生成は不要です。cloneしたリポジトリをnginxのドキュメントルートとして配信してください。既存のnginx設定でディレクトリを静的配信できている場合は、これまでと同じ方法で利用できます。

最小構成の考え方は次のとおりです。

```nginx
server {
    listen 80;
    server_name _;
    root /path/to/ai-quiz;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

カメラAPIはブラウザのセキュリティ制約を受けます。本番公開時はHTTPSを使用してください。

## 既定の問題データ

`questions.json` はリポジトリ直下に置き、アプリから `/questions.json` 相当のURLで読み込みます。既存の公開URLとローカルJSON互換を保つため、このファイルは `assets/` 配下へ移動しません。

提供されたAIクイズ問題マスタ50問のうち、回答を安全に特定できない5問は組み込み出題対象から除外しています。

- No.21〜24: 回答未設定
- No.26: 〇✕形式に対して回答が `A`

既定の出題可能問題数は45問です。

## 問題JSON

従来形式では、設定を省略した場合の回答確定時間は10秒、最大点数は100点です。有効な値を明示した場合はその値を優先します。

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
      "text": "問題文",
      "choices": ["〇", "✕"],
      "correctIndex": 0,
      "difficulty": ["kids", "adults"],
      "image": "images/example.jpg",
      "audio": "audio/question.mp3",
      "explanationAudio": "audio/explanation.mp3",
      "explanation": "採点後の補足説明"
    }
  ]
}
```

`image`、`audio`、`explanationAudio` は同一サイト内の相対パスのみ利用できます。ローカルJSONで音声を明示していない場合、組み込み問題用の連番MP3へ自動対応せず、ブラウザ読み上げへフォールバックします。

## 組み込み音声

公開URL互換を保つため、音声ディレクトリはリポジトリ直下のまま維持しています。

- `音声データ_MP3/01.システム/`：開始、正誤、結果など
- `音声データ_MP3/02.問題/`：問題音声
- `音声データ_MP3/03.問題_補足説明/`：解説音声

音声ファイルは管理者が差し替える運用です。固定SHA-256台帳は管理しません。差し替え時はアプリが参照するファイル名・ディレクトリ構成と、VOICEVOX等の利用条件を維持してください。

## VOICEVOX:ずんだもん

このアプリで配布・再生する `音声データ_MP3/` 以下のMP3は、リポジトリ管理者の申告に基づき **VOICEVOX:ずんだもん** で生成されています。

- VOICEVOX ソフトウェア利用規約: https://voicevox.hiroshiba.jp/term/
- ずんだもん音源利用規約: https://zunko.jp/con_ongen_kiyaku.html
- VOICEVOX Q&A: https://voicevox.hiroshiba.jp/qa/

詳しい扱いは [`docs/AUDIO_LICENSE.md`](docs/AUDIO_LICENSE.md) を参照してください。

## ディレクトリ構成

```text
.
├── index.html                  # 静的サイトの入口
├── questions.json              # 組み込み問題データ（公開URL互換のためルート維持）
├── assets/
│   ├── js/                     # アプリのJavaScript
│   └── css/                    # 表示用CSS
├── images/                     # 説明画像・問題画像
├── 音声データ_MP3/             # 公開URL互換を維持する音声
│   ├── README.md
│   ├── 01.システム/
│   ├── 02.問題/
│   └── 03.問題_補足説明/
├── docs/
│   ├── AUDIO_LICENSE.md
│   ├── DESIGN_GUIDELINES.md
│   └── 問題一覧.md
├── tests/                      # Node.jsによる静的・回帰テスト
├── .github/workflows/          # CI
├── _headers                    # 静的ホスティング向けヘッダー設定
└── README.md
```

## 開発時の確認

GitHub Actionsでは、JavaScript構文、画面遷移、回答表示、音声フロー、既定値、説明画像、VOICEVOXクレジット・規約案内などを検証します。音声ファイルそのものは差し替え可能なため、固定ハッシュによる内容一致検証は行いません。

## 注意事項

- `index.html`、`questions.json`、`images/`、`音声データ_MP3/` の公開パスはアプリや問題データから参照されるため、変更する場合は参照元も同時に更新してください。
- JSONやカメラ映像はブラウザ内で処理し、アプリから任意の外部サーバーへ送信する処理は追加していません。
- MP3が存在しない、または再生できない場合はブラウザのWeb Speech APIへフォールバックすることがあります。
- VOICEVOX・ずんだもん関連の規約は更新される可能性があるため、公開・再配布・商用利用前に最新版を確認してください。
