# 角南商店 開発引き継ぎメモ

最終更新: 2026-07-21

## 目的

このリポジトリは、角南健夫個人の持ち物を譲渡・販売するページ「角南商店」です。スマホで商品登録し、PC/スマホ/タブレットで見やすく一覧できることを重視しています。

公開URL:

https://tsdesignltd.github.io/sale/

## 現在の見た目・仕様

- トップタイトル: `角南商店`
- ヘッダーは削除済み
- プロフィール画像: `portrait.png`
- 自己紹介文:

```text
角南健夫／プロダクトデザイナー
趣味は自転車、工作、ラジコン、サーフィン、素潜り、スノーボード。思い切って断捨離を決意！ご協力お願いしますm(_ _)m。所在は東京都町田市です。
```

- リード文:

```text
仕事で使った製品サンプル、工作材料などが事務所に溜まっています。事務所移転につき溜め込んだ物品を放出します。販売するほどじゃないけど捨てるには勿体ないものは無償（梱包費、送料負担はお願いします）、それ以外は安めの価格で。自転車用品、撮影機材、車用品、デザイン用品など、マニアックなものも沢山あります。必要としてくれる人が使ってくれれば嬉しいです。
```

- HOW TO BUY:
  1. 各カードの「買いたい」または「欲しい」ボタンを押すと、公式LINEへ飛びますので、お名前と気になる品物名をLINEでご連絡ください。
  2. お支払いはPaypayか銀行振込になります。受け渡し方法・送料は個別に相談します。基本は着払い発送になります。引取り歓迎です。
  3. 中古品のため、傷や使用感があります。返品は原則お受けしていません。

## 商品一覧

- 「AVAILABLE ITEMS」ラベルは削除済み
- 見出しは `お譲りするもの`
- 表示順は「新しい商品が左上」
- 商品番号は「古い登録順」で `001`, `002`, ... と表示
  - 例: 新しい商品が `002`、古い商品が `001` の場合、一覧は左から `002`, `001`
- 商品名表示:

```text
002
ヒラメポンプヘッド横型
```

- 商品番号は小さめ、品名は下段に表示

## 商品詳細

- 写真は縦1列に並べる
- 複数写真がある場合は、写真エリアがそのまま縦に伸びる
- 右側の商品情報はPCではsticky表示
- スマホでは写真の下に商品情報が続く

## 商品写真

- 登録/編集画面で最大5枚まで追加可能
- スマホ:
  - `写真を撮る`: camera capture
  - `写真ライブラリから選ぶ`: multiple対応
- 一覧カードは1枚目のみ表示
- 詳細画面は登録された写真を最大5枚表示
- 保存形式:
  - 既存DBの `photo` カラムに保存
  - 1枚なら従来どおり画像Data URL文字列
  - 複数ならJSON配列文字列
- DBカラム追加なしで複数写真に対応済み

## データ/API

Supabase:

- URL: `https://kuxdmlmimltngqjekckk.supabase.co`
- Publishable key: `sb_publishable_C6cNc2gB3JL2wQo3ZyF-HA_OJcGH7hh`
- テーブル: `public.products`
- RPC: `public.admin_product_mutation`

現在想定されている `products` テーブル:

- `id text primary key`
- `name text`
- `category text`
- `free boolean`
- `price integer`
- `description text`
- `status text`
- `photo text`
- `updated_at timestamptz`

登録/編集/削除はRPC経由で行います。

## 管理認証

- 登録・編集にはパスコード認証が必要
- 固定パスコード: `4933`
- フロント側ではセッション中のみ `sessionStorage` に認証状態を保持
- 実際の認証はSupabase RPC側で検証

## 公式LINE

- URL: https://lin.ee/US6LBI4
- 商品カード/詳細のボタンから開く
- 押下時に希望メッセージをコピー

## 連番について

現在の公開版では、フロントエンド側で古い登録順に表示番号を割り当てています。

ただし「削除しても番号を再利用しない」「商品と番号をDB上で一対一に固定する」を厳密に実現するには、Supabase側に `product_number` カラムと採番シーケンスが必要です。

そのためのSQLを `supabase-product-numbering.sql` に用意済みです。

### 重要

`supabase-product-numbering.sql` は未実行の可能性があります。実行する場合はSupabase DashboardのSQL Editorで内容を確認してから適用してください。

実行後は:

- 既存商品へ古い順に番号付与
- 新規登録時に次番号を採番
- 削除後も番号を再利用しない
- RPCレスポンスに `product_number` を含める

フロントエンドはすでに `product_number` が存在する場合それを優先し、存在しない場合は表示用番号へフォールバックします。

## 重要ファイル

- `index.html`
  - 本文、商品登録フォーム、モーダル構造
- `styles.css`
  - レスポンシブ/カード/詳細/編集UI
- `app.js`
  - Supabase通信、商品描画、登録/編集、LINE導線、写真処理、連番表示
- `sw.js`
  - PWAキャッシュ
- `portrait.png`
  - プロフィール画像
- `supabase-product-numbering.sql`
  - DB上で恒久連番を実現する任意SQL

## キャッシュ更新ルール

JS/CSSを変更したら、以下を更新してください。

- `index.html`
  - `styles.css?v=...`
  - `app.js?v=...`
- `sw.js`
  - `CACHE = "sunami-sale-v..."`
  - ASSETS内の `styles.css?v=...`
  - ASSETS内の `app.js?v=...`

## 開発・確認

```sh
cd /Volumes/miniデータミラー8TB/cowork/sale
python3 -m http.server 8000
```

確認URL:

```text
http://127.0.0.1:8000/
```

JS構文チェック:

```sh
node --check app.js
```

GitHub Pages確認:

```sh
gh run list --repo tsdesignltd/sale --limit 3
```

公開反映確認例:

```sh
curl -sS -H 'Cache-Control: no-cache' 'https://tsdesignltd.github.io/sale/?v=<commit>-1'
```

## 注意点

- `photo` カラムにData URLを保存しているため、写真枚数やサイズが増えるとDB行サイズが大きくなります。
  - 現在はブラウザ側で長辺1400px、JPEG品質0.82へリサイズ
- Supabaseのpublishable keyは公開前提ですが、service role keyは絶対にコミットしないでください。
- GitHub PagesはService Workerやブラウザキャッシュの影響があるため、動作確認時はクエリ付きURLを使うと安全です。
- 既存の `portrait.svg` は残っていますが、現在使っているプロフィール画像は `portrait.png` です。
