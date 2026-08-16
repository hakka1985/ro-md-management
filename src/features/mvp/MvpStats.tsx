import { useMvpKills, useMvpMaster } from "./useMvp";
import { yearOf } from "../../lib/date";
import { useTableSort } from "../../lib/useTableSort";
import { SortableHeader } from "../../components/SortableHeader";

interface YearStatRow {
  year: number;
  count: number;
}

function yearSortValue(r: YearStatRow, key: string): string | number {
  switch (key) {
    case "year":
      return r.year;
    case "count":
      return r.count;
    default:
      return "";
  }
}

interface MvpStatRow {
  mvpId: string;
  mvpName: string;
  kills: number;
  cardDrops: number;
  cardDropRate: number;
  itemDropRates: { itemName: string; drops: number; rate: number }[];
}

function mvpSortValue(r: MvpStatRow, key: string): string | number {
  switch (key) {
    case "mvpName":
      return r.mvpName;
    case "kills":
      return r.kills;
    case "cardDrops":
      return r.cardDrops;
    case "cardDropRate":
      return r.cardDropRate;
    default:
      return "";
  }
}

export function MvpStats() {
  const { kills } = useMvpKills();
  const { mvpMaster } = useMvpMaster();

  const mvpById = new Map(mvpMaster.map((m) => [m.id, m]));

  const byYear = new Map<number, number>();
  const byMvp = new Map<
    string,
    { kills: number; cards: number; items: Map<string, number> }
  >();
  let totalCards = 0;

  for (const k of kills) {
    const year = yearOf(k.killedAt);
    byYear.set(year, (byYear.get(year) ?? 0) + 1);

    const entry = byMvp.get(k.mvpId) ?? {
      kills: 0,
      cards: 0,
      items: new Map<string, number>(),
    };
    entry.kills += 1;
    if (k.cardDropped) entry.cards += 1;
    for (const name of k.itemsDropped ?? []) {
      entry.items.set(name, (entry.items.get(name) ?? 0) + 1);
    }
    byMvp.set(k.mvpId, entry);
    if (k.cardDropped) totalCards += 1;
  }

  const years: YearStatRow[] = [...byYear.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);

  const mvpRows: MvpStatRow[] = [...byMvp.entries()]
    .map(([mvpId, entry]) => {
      const mvp = mvpById.get(mvpId);
      const dropItemNames = mvp?.dropItems ?? [];
      return {
        mvpId,
        mvpName: mvp?.name ?? "（不明なMVP）",
        kills: entry.kills,
        cardDrops: entry.cards,
        cardDropRate: entry.kills > 0 ? (entry.cards / entry.kills) * 100 : 0,
        itemDropRates: dropItemNames.map((name) => {
          const drops = entry.items.get(name) ?? 0;
          return {
            itemName: name,
            drops,
            rate: entry.kills > 0 ? (drops / entry.kills) * 100 : 0,
          };
        }),
      };
    })
    .sort((a, b) => b.kills - a.kills);

  const dropRate = kills.length > 0 ? (totalCards / kills.length) * 100 : 0;

  const yearSort = useTableSort(years, yearSortValue);
  const mvpSort = useTableSort(mvpRows, mvpSortValue);

  if (kills.length === 0) {
    return (
      <section className="panel">
        <h2>統計</h2>
        <p className="empty">
          記録が増えると、ここに討伐数やカードドロップ率が表示されます。
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>統計</h2>
      <ul className="stat-list">
        <li>
          総討伐数: <strong>{kills.length}</strong>体
        </li>
        <li>
          カードドロップ率: <strong>{dropRate.toFixed(1)}%</strong>
        </li>
      </ul>

      <h3>年別討伐数</h3>
      <div className="scrollable-table">
        <table className="md-master-table">
          <thead>
            <tr>
              <SortableHeader
                label="年"
                sortKey="year"
                activeKey={yearSort.sortKey}
                dir={yearSort.sortDir}
                onSort={yearSort.toggleSort}
              />
              <SortableHeader
                label="討伐数"
                sortKey="count"
                activeKey={yearSort.sortKey}
                dir={yearSort.sortDir}
                onSort={yearSort.toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {yearSort.sorted.map((y) => (
              <tr key={y.year}>
                <td>{y.year}年</td>
                <td>{y.count}体</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>MVP別集計</h3>
      <p className="hint">
        アイテムドロップ率は、MVPマスタに登録したカード以外のドロップ品それぞれについて
        「討伐N回中M回ドロップ」から算出しています。
      </p>
      <div className="scrollable-table">
        <table className="md-master-table">
          <thead>
            <tr>
              <SortableHeader
                label="MVP名"
                sortKey="mvpName"
                activeKey={mvpSort.sortKey}
                dir={mvpSort.sortDir}
                onSort={mvpSort.toggleSort}
              />
              <SortableHeader
                label="討伐数"
                sortKey="kills"
                activeKey={mvpSort.sortKey}
                dir={mvpSort.sortDir}
                onSort={mvpSort.toggleSort}
              />
              <SortableHeader
                label="カード枚数"
                sortKey="cardDrops"
                activeKey={mvpSort.sortKey}
                dir={mvpSort.sortDir}
                onSort={mvpSort.toggleSort}
              />
              <SortableHeader
                label="カードドロップ率"
                sortKey="cardDropRate"
                activeKey={mvpSort.sortKey}
                dir={mvpSort.sortDir}
                onSort={mvpSort.toggleSort}
              />
              <th>アイテムドロップ率</th>
            </tr>
          </thead>
          <tbody>
            {mvpSort.sorted.map((r) => (
              <tr key={r.mvpId}>
                <td>{r.mvpName}</td>
                <td>{r.kills}体</td>
                <td>{r.cardDrops}枚</td>
                <td>{r.cardDropRate.toFixed(1)}%</td>
                <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                  {r.itemDropRates.length === 0
                    ? "—"
                    : r.itemDropRates
                        .map(
                          (i) =>
                            `${i.itemName}: ${i.rate.toFixed(1)}%（${i.drops}/${r.kills}）`,
                        )
                        .join("　")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
