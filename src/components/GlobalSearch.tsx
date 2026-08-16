import { useState } from "react";
import { Modal } from "./Modal";
import { useMdDungeons } from "../features/md/useMd";
import { useItemPrices } from "../features/finance/useFinance";
import { useCharacters } from "../features/characters/useCharacters";
import { useMvpMaster } from "../features/mvp/useMvp";
import { useGoals } from "../features/goals/useGoals";
import type { TabKey } from "./layout/SideNav";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: TabKey) => void;
}

interface SearchResult {
  id: string;
  category: string;
  label: string;
  tab: TabKey;
}

const MAX_PER_CATEGORY = 8;

/** Cross-feature search — MD/item/character/MVP names all live in different tabs, so this is the one place that searches all of them at once and jumps you to the right tab. */
export function GlobalSearch({ open, onClose, onNavigate }: Props) {
  const { dungeons } = useMdDungeons();
  const { itemPrices } = useItemPrices();
  const { characters } = useCharacters();
  const { mvpMaster } = useMvpMaster();
  const { goals } = useGoals();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const results: SearchResult[] = !q
    ? []
    : [
        ...dungeons
          .filter((d) => d.name.toLowerCase().includes(q))
          .slice(0, MAX_PER_CATEGORY)
          .map((d) => ({
            id: `md-${d.id}`,
            category: "MD",
            label: d.name,
            tab: "md" as TabKey,
          })),
        ...itemPrices
          .filter((p) => p.itemName.toLowerCase().includes(q))
          .slice(0, MAX_PER_CATEGORY)
          .map((p) => ({
            id: `item-${p.id}`,
            category: "アイテム",
            label: p.itemName,
            tab: "itemMaster" as TabKey,
          })),
        ...characters
          .filter((c) => c.name.toLowerCase().includes(q))
          .slice(0, MAX_PER_CATEGORY)
          .map((c) => ({
            id: `char-${c.id}`,
            category: "キャラクター",
            label: c.name,
            tab: "characters" as TabKey,
          })),
        ...mvpMaster
          .filter((m) => m.name.toLowerCase().includes(q))
          .slice(0, MAX_PER_CATEGORY)
          .map((m) => ({
            id: `mvp-${m.id}`,
            category: "MVP",
            label: m.name,
            tab: "mvpMaster" as TabKey,
          })),
        ...goals
          .filter((g) => g.title.toLowerCase().includes(q))
          .slice(0, MAX_PER_CATEGORY)
          .map((g) => ({
            id: `goal-${g.id}`,
            category: "目標",
            label: g.title,
            tab: "goals" as TabKey,
          })),
      ];

  function handleSelect(result: SearchResult) {
    onNavigate(result.tab);
    setQuery("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
    >
      <div className="stacked-form">
        <h2>検索</h2>
        <input
          placeholder="MD名・アイテム名・キャラ名・MVP名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {q && results.length === 0 && (
          <p className="empty">一致するものがありません</p>
        )}
        <ul className="global-search-results">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="global-search-result"
                onClick={() => handleSelect(r)}
              >
                <span className="global-search-category">{r.category}</span>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
