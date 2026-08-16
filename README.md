# RO管理ツール

Ragnarok Onlineのマルチデポジションダンジョン(MD)周回・MVP討伐・売買資産を個人管理するためのツール。React + TypeScript + Vite製、データはブラウザのIndexedDB（Dexie.js）にのみ保存され、外部サーバーへは送信されない。複数PCで使う場合は設定タブのエクスポート/インポート（JSON）で同期する。

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

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
