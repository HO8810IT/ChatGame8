# ChatGame

Electron + React で作る Windowsローカル向けチャットゲームのひな形です。

## セットアップ

```powershell
npm install
```

## 開発実行

1. ターミナル1: `npm run dev`
2. ターミナル2: `npm run start`

## ビルド

```powershell
npm run build
```

## 開発起動

Windows ではバッチファイルから一括起動できます。

```powershell
start-dev.bat
```

これにより、次の 2 つのウィンドウが自動的に開きます。

- Vite 開発サーバ
- Electron アプリ

## ローカルLLMセットアップ

このアプリはローカルで動作する `llama-server.exe` とローカルモデルファイルを使って会話できます。

### 1) llama.cpp をセットアップ

1. `llama.cpp` の Windows ビルドをダウンロードして `C:\Develop\ChatGame\llama.cpp\` に展開します
   - `llama-server.exe` が含まれていることを確認してください

2. 日本語対応の軽量モデルをダウンロードして、`C:\Develop\ChatGame\models\` に配置します
   - 例: `Qwen3-1.7B-Q6_K.gguf` のような GGML 形式モデル
   - 推奨: 4bit 量子化（Q4 or Q5）の 7B クラスモデル

### 2) アプリを起動

```powershell
# ChatGame フォルダで
start-dev.bat
```

### 3) モデルを選択

アプリ起動後、画面上部の「モデル選択」ドロップダウンで使いたいモデルを選択します。初回は数秒でモデルがロードされます。


### モデルの選び方

- 軽量で日本語に強いモデルを探す場合は、GGML 形式の日本語チューニング済みモデルを選んでください
- `llama.cpp` なら `llama-japanese-7b-q4_0.bin` のような 4bit 量子化モデルが扱いやすくおすすめです。
- `gpt4all` なら日本語対応モデルの `gpt4all-japanese.bin` などを選択します

### おすすめモデル例

1. `llama-japanese-7b-q4_0.bin`
   - 特徴: 7B で比較的軽量、4bit 量子化により CPU でも動かしやすい
   - 使い所: 自由な日本語会話、フィルターが緩めの日本語応答
   - 保存先: `C:\Develop\ChatGame\models\llama-japanese-7b-q4_0.bin`

2. `gpt4all-japanese.bin`（GPT4All 用）
   - 特徴: GPT4All バイナリ向けに最適化された日本語対応モデル
   - 保存先: `C:\Develop\ChatGame\models\gpt4all-japanese.bin`

### ダウンロード先の探し方

- Hugging Face: `https://huggingface.co/search?q=llama+japanese+ggml`
- Civitai などのコミュニティサイトで「japanese ggml」「llama 7b q4_0」などを検索

### models フォルダの使い方

このプロジェクトでは `C:\Develop\ChatGame\models\` フォルダ内のモデルを使うように設計しています。
環境変数を設定しない場合、デフォルトでは次のファイルを参照します。

```powershell
C:\Develop\ChatGame\models\japanese.bin
```

アプリ起動後、画面右側の「モデル選択」プルダウンで `models` フォルダ内のモデルを選択できます。


モデル名を分かりやすく保存したい場合は、次のように環境変数で明示してください。

```powershell
set LLM_MODEL_PATH=C:\Develop\ChatGame\models\llama-japanese-7b-q4_0.bin
```

### 使い方

1. アプリを起動（`start-dev.bat`）
2. 画面上部の「モデル選択」ドロップダウンで使いたいモデルを選択
3. 「モデルをロード中...」表示が消えて「✅ モデルをロードしました」が表示されたら準備完了
4. 左側でキャラクターを選択
5. 中央の入力欄に日本語でメッセージを入力して送信
6. 右側に選択中キャラクターのプロンプトが表示されます

### パフォーマンス

- モデルは最初の選択時にロード（初回は数秒かかります）
- ロード後のメッセージ送信はメモリに常駐したモデルを使用（高速です）
- モデル選択ドロップダウンから別のモデルに変更するとサーバーが再起動します

## 特徴

- シーン単位のチャットUI
- 複数キャラクターの切り替え
- ローカルLLM（llama-server）の常時メモリ常駐
- HTTP ベースの通信（将来のマルチスレッド対応に対応）
- `electron/main.js` で `ipcMain` を使い、`electron/preload.js` 経由でレンダラーからアクセス
