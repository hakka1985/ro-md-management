export type TabKey =
  | "dashboard"
  | "mvp"
  | "mvpMaster"
  | "md"
  | "mdMaster"
  | "finance"
  | "itemMaster"
  | "revenue"
  | "wishlist"
  | "cashFlow"
  | "goals"
  | "characters"
  | "guide"
  | "baseline"
  | "settings";

interface NavGroup {
  label: string;
  tabs: { key: TabKey; label: string }[];
}

// Grouped rather than one flat list — the tab count has grown a lot as
// features were added, and "運用で毎日触る画面" vs "マスタを整備する画面" vs
// "たまにしか開かない設定系" are meaningfully different modes of use.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "運用",
    tabs: [
      { key: "dashboard", label: "📊 ダッシュボード" },
      { key: "mvp", label: "👑 MVPカウンター" },
      { key: "md", label: "⚔️ MD進捗" },
      { key: "finance", label: "💰 取引・在庫" },
      { key: "revenue", label: "📈 収益" },
      { key: "wishlist", label: "🎁 欲しい物" },
      { key: "cashFlow", label: "💹 資金計画" },
      { key: "goals", label: "🎯 目標" },
    ],
  },
  {
    label: "マスタ管理",
    tabs: [
      { key: "characters", label: "👤 キャラクター管理" },
      { key: "mvpMaster", label: "👑 MVPマスタ" },
      { key: "mdMaster", label: "⚔️ MDマスタ" },
      { key: "itemMaster", label: "📦 アイテムマスタ" },
    ],
  },
  {
    label: "その他",
    tabs: [
      { key: "guide", label: "📖 ガイド" },
      { key: "baseline", label: "📍 基準値設定" },
      { key: "settings", label: "⚙️ 設定" },
    ],
  },
];

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  open: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
}

export function SideNav({
  active,
  onChange,
  open,
  onClose,
  onOpenSearch,
}: Props) {
  return (
    <>
      {open && <div className="side-nav-backdrop" onClick={onClose} />}
      <nav className={open ? "side-nav side-nav-open" : "side-nav"}>
        <h1 className="side-nav-title">RO管理ツール</h1>
        <button type="button" onClick={onOpenSearch} style={{ marginBottom: "0.5rem" }}>
          🔍 検索
        </button>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="side-nav-group">
            <div className="side-nav-group-label">{group.label}</div>
            {group.tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={tab.key === active ? "side-nav-active" : ""}
                onClick={() => onChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
