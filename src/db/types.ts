export interface Character {
  id: string;
  name: string;
  server: string;
  /** Game account this character belongs to — groups characters for MD entry limits that are shared across a whole account, not per-character. */
  account?: string;
  job?: string;
  level?: number;
  memo?: string;
  archived?: boolean;
  /** True if this character can't do MDs at all (e.g. below the level gate) — excluded from every MD, not just one. */
  mdExcluded?: boolean;
  /** Cash the character is currently holding (not inventory/trade-derived) — feeds the dashboard's total assets. */
  money?: number;
  sortOrder?: number;
  /** Pinned characters sort first regardless of sortOrder — for the few you actually touch every day. */
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type MdCtType = "daily" | "3days" | "weeklyTue12";

/** One selectable mode of a dungeon that has more than one (e.g. 討伐/生存モード) — each has its own MVP mob list, since the mobs that appear depend on which mode was chosen. */
export interface MdDungeonMode {
  name: string;
  mvpMobs: string[];
}

export interface MdDungeon {
  id: string;
  name: string;
  ctType: MdCtType;
  items: Record<string, number>;
  mvpMobs: string[];
  category?: string;
  memo?: string;
  sortOrder?: number;
  archived?: boolean;
  /** Character IDs that cannot enter this MD (e.g. level/quest gate) — excluded from progress counts. */
  excludedCharacterIds?: string[];
  /** Some MDs cap how many characters from the same account can challenge it per cycle — undefined means no cap. */
  accountCharacterLimit?: number;
  /** Minimum character level needed to enter — characters below this (or with no level set) are automatically treated as excluded, independent of excludedCharacterIds. */
  requiredLevel?: number;
  /** Some MDs let a single character challenge more than once before the CT locks them out (e.g. 2 clears per cycle) — undefined/1 means the usual single attempt. */
  attemptsPerCycle?: number;
  /** Selectable modes (e.g. 討伐/生存モード) whose MVP mobs differ — undefined/empty means this dungeon has just the one mode, using mvpMobs as-is. */
  modes?: MdDungeonMode[];
  /** Pinned dungeons sort first regardless of sortOrder — for the few you run every day. */
  pinned?: boolean;
}

export interface MdRun {
  id: string;
  characterId: string;
  dungeonId: string;
  completedAt: number;
  mvpDefeats: Record<string, boolean>;
  clearTimeSeconds?: number;
  items?: Record<string, number>;
  memo?: string;
  /** Which of the dungeon's modes was cleared, when the dungeon has more than one — undefined for single-mode dungeons. */
  modeName?: string;
  /** Estimated zeny spent on consumables (potions, materials, etc.) for this run — subtracted from the drop value to get a net (not just gross) efficiency figure. */
  estimatedCost?: number;
  createdAt: number;
}

export interface AppConfig {
  key: string;
  value: unknown;
}

export interface MvpMaster {
  id: string;
  name: string;
  map?: string;
  cardName?: string;
  /** Other notable drop items besides the card (e.g. equipment) — the MVP can have several. */
  dropItems?: string[];
  memo?: string;
  archived?: boolean;
}

export interface MvpKill {
  id: string;
  mvpId: string;
  characterId?: string;
  killedAt: number;
  cardDropped: boolean;
  cardName?: string;
  /** Which of the MVP master's non-card dropItems dropped this kill — undefined/empty means none (or not tracked, e.g. MD連動 auto-logged kills). */
  itemsDropped?: string[];
  memo?: string;
  createdAt: number;
}

export type FinanceType = "income" | "expense";
export type FinanceSource = "mvp" | "md" | "market" | "other";

export interface FinanceTransaction {
  id: string;
  type: FinanceType;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  date: number;
  characterId?: string;
  source?: FinanceSource;
  sourceRefId?: string;
  partySize?: number;
  /** True for one-off windfalls (event drops sold, giveaway proceeds, etc.) — excluded from the wishlist's weekly income average so a temporary spike doesn't overstate ongoing affordability. */
  isEventIncome?: boolean;
  /** Free-text labels for reflective analysis (e.g. "周年イベント", "○○鯖用") — a transaction can carry several. Powers the収益タブ's タグ別収支 breakdown. */
  tags?: string[];
  memo?: string;
  createdAt: number;
}

export interface ItemPrice {
  id: string;
  itemName: string;
  expectedPrice: number;
  url?: string;
  memo?: string;
  archived?: boolean;
  /** When expectedPrice was last changed — powers the price-staleness hint so efficiency figures based on an old price get flagged. */
  updatedAt?: number;
}

export interface InventoryItem {
  id: string;
  itemName: string;
  quantity: number;
  /** Free-text note for the stock row — general-purpose (not PT-specific; see PartyObtainEntry for that). */
  memo?: string;
  updatedAt: number;
}

/**
 * A PT-shared obtain (event MD drops split among a party, etc.), recorded
 * as its own history entry — unlike a plain 入手 (stock-only, no record at
 * all), this is what lets a mixed-origin stack later be broken back down
 * into "how much came from which PT run, split with whom." Adds
 * `myShare` (= partyShare(totalQuantity, partySize)) to inventory on save.
 */
export interface PartyObtainEntry {
  id: string;
  itemName: string;
  totalQuantity: number;
  partySize: number;
  members: string[];
  myShare: number;
  date: number;
  memo?: string;
  /** Manually marked once this batch has actually been resolved (sold and its proceeds distributed via 貸し借り, or personally consumed) — items aren't individually tracked once merged into inventory, so there's no way to auto-detect this from a later sell/consume record. */
  settled?: boolean;
  createdAt: number;
}

/** A saved PT member name — lets 販売/入手/MD進捗's member fields offer a pick list instead of retyping the same names every time. Just a name list, no per-member stats. */
export interface PartyMember {
  id: string;
  name: string;
  archived?: boolean;
  createdAt: number;
}

export interface WishlistItem {
  id: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  memo?: string;
  obtained?: boolean;
  priority?: number;
  createdAt: number;
}

/** "borrowed" = 借りた（負債、いずれ返す必要がある）。"lent" = 貸した（債権、いずれ返ってくる）。*/
export type DebtDirection = "borrowed" | "lent";

/**
 * Cash lent/borrowed with another player — kept separate from
 * FinanceTransaction (which is item-trade-centric) so it never inflates
 * 実績利益/収益 as if it were earned income. Only the outstanding balance
 * (amount - repaidAmount) affects 合計資産, as a liability (borrowed) or
 * asset (lent).
 */
export interface DebtEntry {
  id: string;
  direction: DebtDirection;
  counterparty: string;
  amount: number;
  repaidAmount: number;
  date: number;
  memo?: string;
  createdAt: number;
}

/** "sell" = 将来売る予定（資金プラス）。"buy" = 将来買う予定（資金マイナス）。*/
export type CashFlowPlanKind = "sell" | "buy";

/**
 * A planned (not-yet-executed) future sell/buy — separate from
 * FinanceTransaction (which only records what's already happened). Ordered
 * by priority so 資金計画 can project a cumulative running balance as if
 * each entry were executed in that order, letting the user see roughly when
 * they'd cross a target amount.
 */
export interface CashFlowPlanEntry {
  id: string;
  kind: CashFlowPlanKind;
  itemName: string;
  quantity: number;
  unitPrice: number;
  priority: number;
  /** Marked once actually executed — shown struck-through in the list, but still counted in the running-balance projection (the plan itself doesn't change just because one step is done). */
  done?: boolean;
  memo?: string;
  createdAt: number;
}

/** 短期/中期/長期 — a free-form goal list, grouped into three horizons rather than tied to fixed timeframes (a "短期" goal might be a week or a month; what matters is the relative ordering). */
export type GoalTier = "short" | "mid" | "long";

/**
 * A savings milestone: reach `targetAmount` in 合計資産（全部売れたら）, the
 * same figure the dashboard tracks. Optionally tied to a WishlistItem so
 * the goal reads as "save up X to afford Y" instead of a bare number —
 * linking is by id (not duplicating the item's cost) so the wishlist stays
 * the single source of truth for that item's price.
 */
export interface Goal {
  id: string;
  title: string;
  tier: GoalTier;
  targetAmount: number;
  /** Optional — when set, the goal's card shows the linked wishlist item's name/cost instead of requiring a separately-typed title. */
  wishlistItemId?: string;
  deadline?: number;
  /** Manually marked once the reward is actually claimed — kept independent of the progress-bar math (reaching 100% doesn't auto-complete it, since "saved enough" and "actually bought it" are different moments). */
  achieved?: boolean;
  memo?: string;
  sortOrder: number;
  createdAt: number;
}
