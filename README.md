# 角南商店

角南健夫の個人所有品を譲渡・販売する、静的HTML/CSS/JavaScriptの中古品販売ページです。

公開URL:

https://tsdesignltd.github.io/sale/

GitHub:

https://github.com/tsdesignltd/sale

## 現在の主な機能

- 商品一覧をレスポンシブ表示
  - PC/タブレットでは多列表示
  - スマホでは2列表示
  - 新しい登録商品が左上に表示されます
- 商品登録・編集
  - 登録/編集にはパスコード認証が必要
  - 固定パスコード: `4933`
  - スマホで写真撮影、写真ライブラリ選択が可能
  - 商品写真は最大5枚まで登録可能
  - 一覧カードでは1枚目のみ表示
  - 詳細画面では写真を縦1列に並べて表示
- 商品情報
  - 品名
  - カテゴリ
  - 価格（無料/日本円）
  - 説明文
  - 販売状況（販売中/商談中/売約済み）
- カテゴリ
  - 家具
  - 家電
  - 衣類
  - 本・音楽
  - カメラ・映像
  - 車用品
  - アウトドア
  - 自転車用品
  - ラジコン用品
  - 工作材料
  - 趣味・道具
  - その他
- 連絡導線
  - 「買いたい」「欲しい」ボタンから公式LINEを開く
  - 公式LINE: https://lin.ee/US6LBI4
  - 希望メッセージをクリップボードへコピー
- 連番表示
  - 商品番号は `001` のように3桁表示
  - 商品名では番号と品名を改行して表示
  - 現状のフロントエンドでは、古い登録順に番号を割り当て、新しい商品から一覧表示します

## 技術構成

- 静的サイト
  - `index.html`
  - `styles.css`
  - `app.js`
  - `sw.js`
- デプロイ
  - GitHub Pages
- データ保存
  - Supabase REST API
- PWA対応
  - `manifest.webmanifest`
  - `sw.js`

## Supabase設定

アプリ内で使っているSupabaseプロジェクト:

- Project URL: `https://kuxdmlmimltngqjekckk.supabase.co`
- Publishable key: `sb_publishable_C6cNc2gB3JL2wQo3ZyF-HA_OJcGH7hh`
- テーブル: `public.products`
- 管理用RPC: `public.admin_product_mutation`

公開キーはブラウザで使う前提のpublishable keyです。Service role keyなどの秘密鍵はリポジトリへ入れないでください。

## ローカルで確認

```sh
cd /Volumes/miniデータミラー8TB/cowork/sale
python3 -m http.server 8000
```

ブラウザで開きます。

```text
http://127.0.0.1:8000/
```

## 公開手順

変更後は通常どおりcommitしてpushします。

```sh
git status --short
git add index.html styles.css app.js sw.js
git commit -m "変更内容"
git push
```

GitHub Pagesのデプロイ状況確認:

```sh
gh run list --repo tsdesignltd/sale --limit 3
```

キャッシュ対策として、HTML内の `styles.css?v=...` と `app.js?v=...`、および `sw.js` の `CACHE` を更新しています。

## 引き継ぎメモ

詳しい作業経緯、注意点、未完了事項は [HANDOFF.md](./HANDOFF.md) を参照してください。
