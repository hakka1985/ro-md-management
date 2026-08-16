# RO管理ツール

Ragnarok OnlineのMD（マルチデポジションダンジョン）周回・MVP討伐・売買資産を個人管理するためのツール。React + TypeScript + Vite製、データはブラウザのIndexedDB（Dexie.js）にのみ保存され、外部サーバーへは送信されない。複数PCで使う場合は「設定」タブのエクスポート/インポート（JSON）で同期する。

**公開先:** [https://hakka1985.github.io/ro-md-management/](https://hakka1985.github.io/ro-md-management/)（`main`へのpushで自動デプロイ、`.github/workflows/deploy.yml`）

## 主な機能

- **MD進捗**: キャラ×MDのグリッドで周回記録、CT（翌日/3日/週間）の自動判定、PT分配、複数キャラ一括記録
- **MVPカウンター/マスタ**: 討伐記録、カード・ドロップ品の集計、MD進捗との自動連動
- **取引・在庫**: 販売/購入/入手/消費の記録、在庫評価額、タグ付け・一括操作
- **収益/ダッシュボード**: 実績利益・資産推移・MD別効率分析・週次/月次の振り返り、実績バッジ
- **欲しいものリスト/資金計画/目標**: 購入見積り、優先順位付きの資金シミュレーション、短期・中期・長期の資金目標（欲しいものリストと連動可）
- **PWA対応**: ホーム画面・デスクトップにインストール可能、オフラインでも起動可能
- キャラクター・MD・MVP・アイテムの各マスタ管理、全体横断検索

使い方の詳細はアプリ内の「ガイド」タブを参照。

## 開発

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # 型チェック（tsc -b）＋ビルド
npm run lint     # oxlint
npm run format   # prettier
```

## 各マスタの初期値の登録方法

MVPマスタ・MDマスタ・アイテムマスタには、それぞれ「起動時に一度だけ挿入される初期データ（シード）」がソースコード内にハードコードされている。書き換えると、まだ一度もそのテーブルにデータが入っていない**新規インストール時**（またはエクスポート→全データ消去→インポートしていない状態）にだけ反映される。**既に運用中のデータベースには反映されない**ので、そちらはアプリ内の登録UIから追加する（後述）。

| マスタ | シードファイル | 挿入先テーブル | 判定（`src/db/seed.ts`） |
|---|---|---|---|
| MVPマスタ | `src/features/mvp/masterData.ts`（`mvpMasterSeed`） | `mvpMaster` | `mvpMaster`が0件のときのみ挿入 |
| MDマスタ | `src/features/md/masterData.ts`（`mdDungeonSeed`） | `mdDungeons` | `mdDungeons`が0件のときのみ挿入 |
| アイテムマスタ | `src/features/finance/masterData.ts`（`itemPriceSeed`） | `itemPrices` | `itemPrices`が0件のときのみ挿入 |

### MVPマスタ（`mvpMasterSeed`）

```ts
export const mvpMasterSeed: Omit<MvpMaster, "id">[] = [
  { name: "MVP名", cardName: "カード名", map: "マップ名", dropItems: ["ドロップ品A", "ドロップ品B"] },
];
```

`cardName` / `map` / `dropItems` / `memo` はすべて任意。

### MDマスタ（`mdDungeonSeed`）

```ts
{
  name: "MD名",
  ctType: "daily" | "3days" | "weeklyTue12", // 翌日リセット / 3日CT / 毎週火曜12時リセット
  items: {
    アイテム名A: 40, // >0 = 固定/確定入手数量
    アイテム名B: 0,  // 0 = 数量が周回ごとに変わる報酬（周回時に手入力）
  },
  sortOrder: 0, // 表示順（省略可、未指定は999扱いで末尾）
  accountCharacterLimit: 4, // アカウントあたりの挑戦可能キャラ数上限（任意）
  requiredLevel: 175,        // 必要Lv（任意、未達キャラはMD進捗で自動的に「対象外」になる）
}
```

`mvpMobs`（MVP MOB名の配列）はシードでは持たせず空配列固定。MD追加後にMDマスタタブの「MOB追加」ダイアログから設定する。

### アイテムマスタ（`itemPriceSeed`）

```ts
export const itemPriceSeed: Omit<ItemPrice, "id">[] = [
  { itemName: "アイテム名", expectedPrice: 100000 }, // z単位の想定売却単価
];
```

NPC固定売却価格など確定額が分かっているものだけを入れる想定。それ以外のアイテムは`expectedPrice: 0`のまま登録しておき、ユーザーがアイテムマスタタブで随時上書きする（MDマスタにアイテムを追加すると、`expectedPrice: 0`で自動的にアイテムマスタにも登録される）。

### 既存データベースへの追加（推奨）

シードファイルの編集は新規インストール時の初期値を変えるだけなので、既に使っているデータベースに追加したい場合はアプリ内のUIを使う。

- **MVPマスタ**: 「MVPマスタ」タブ →「+ MVPを登録する」ダイアログ
- **MDマスタ**: 「MDマスタ」タブ下部の「MD追加」フォーム
- **アイテムマスタ**: 「アイテムマスタ」タブの登録フォーム（またはMDマスタにアイテムを追加すると自動登録される）
