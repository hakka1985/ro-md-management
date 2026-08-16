import { useEffect, useState } from "react";
import { SideNav, type TabKey } from "./SideNav";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { MvpPage } from "../../features/mvp/MvpPage";
import { MvpMasterPage } from "../../features/mvp/MvpMasterPage";
import { MdPage } from "../../features/md/MdPage";
import type { MdRecordTarget } from "../../features/md/MdGrid";
import { MdMasterPage } from "../../features/md/MdMasterPage";
import { FinancePage } from "../../features/finance/FinancePage";
import { ItemMasterPage } from "../../features/finance/ItemMasterPage";
import { RevenuePage } from "../../features/revenue/RevenuePage";
import { WishlistPage } from "../../features/wishlist/WishlistPage";
import { CashFlowPage } from "../../features/cashflow/CashFlowPage";
import { GoalsPage } from "../../features/goals/GoalsPage";
import { GuidePage } from "../../features/guide/GuidePage";
import { SettingsPage } from "../../features/settings/SettingsPage";
import { CharactersPage } from "../../features/characters/CharactersPage";
import { BaselinePage } from "../../features/settings/BaselinePage";
import { GlobalSearch } from "../GlobalSearch";

const ACTIVE_TAB_KEY = "ro-md-management:activeTab";
const VALID_TABS: TabKey[] = [
  "dashboard",
  "mvp",
  "mvpMaster",
  "md",
  "mdMaster",
  "finance",
  "itemMaster",
  "revenue",
  "wishlist",
  "cashFlow",
  "goals",
  "characters",
  "guide",
  "baseline",
  "settings",
];

function readInitialTab(): TabKey {
  const stored = localStorage.getItem(ACTIVE_TAB_KEY);
  if (VALID_TABS.includes(stored as TabKey)) {
    return stored as TabKey;
  }
  return "dashboard";
}

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>(readInitialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mdRecordTarget, setMdRecordTarget] = useState<MdRecordTarget | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  function goToMdRecord(dungeonId: string, characterId: string) {
    setMdRecordTarget({ dungeonId, characterId });
    setActiveTab("md");
  }

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(true)}
      >
        ☰ RO管理ツール
      </button>
      <SideNav
        active={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setSidebarOpen(false);
        }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />
      <main className="app-main">
        {activeTab === "dashboard" && (
          <DashboardPage onRecordCharacter={goToMdRecord} />
        )}
        {activeTab === "mvp" && <MvpPage />}
        {activeTab === "mvpMaster" && <MvpMasterPage />}
        {activeTab === "md" && (
          <MdPage
            pendingRecordTarget={mdRecordTarget}
            onConsumeRecordTarget={() => setMdRecordTarget(null)}
          />
        )}
        {activeTab === "mdMaster" && <MdMasterPage />}
        {activeTab === "finance" && <FinancePage />}
        {activeTab === "itemMaster" && <ItemMasterPage />}
        {activeTab === "revenue" && <RevenuePage />}
        {activeTab === "wishlist" && <WishlistPage />}
        {activeTab === "cashFlow" && <CashFlowPage />}
        {activeTab === "goals" && <GoalsPage />}
        {activeTab === "characters" && <CharactersPage />}
        {activeTab === "guide" && <GuidePage />}
        {activeTab === "baseline" && <BaselinePage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
