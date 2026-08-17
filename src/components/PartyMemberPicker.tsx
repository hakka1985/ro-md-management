import { usePartyMembers } from "../features/finance/useFinance";
import { parseMemberNames } from "../lib/party";

interface Props {
  /** Space/comma-separated member names — same raw format every PTメンバー field already stores as its input value, so this component is a drop-in for the plain `<input>` it replaces. */
  value: string;
  onChange: (value: string) => void;
}

/** Checkbox pick-list sourced from the saved PT member master, backed by the same free-text value every PTメンバー field already used — checking a name adds it to the text, typing still works for one-off names not in the master. Handles any number of members (not just 1-2) since it's just toggling entries in a space-separated list. */
export function PartyMemberPicker({ value, onChange }: Props) {
  const { members } = usePartyMembers();
  const activeMembers = (members ?? []).filter((m) => !m.archived);
  const selected = new Set(parseMemberNames(value));

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange([...next].join(" "));
  }

  return (
    <div>
      {activeMembers.length > 0 && (
        <div className="inline-form" style={{ marginBottom: "0.3rem" }}>
          {activeMembers.map((m) => (
            <label key={m.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={selected.has(m.name)}
                onChange={() => toggle(m.name)}
              />
              {m.name}
            </label>
          ))}
        </div>
      )}
      <input
        placeholder={
          activeMembers.length > 0
            ? "その他（自由入力、スペース・カンマ区切りで複数可）"
            : "例: 相方A 相方B（スペース・カンマ区切りで複数可）"
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
