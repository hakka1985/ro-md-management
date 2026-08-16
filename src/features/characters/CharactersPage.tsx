import { CharacterSettings } from "./CharacterSettings";
import { CharacterBulkImport } from "./CharacterBulkImport";

export function CharactersPage() {
  return (
    <div className="page">
      <CharacterSettings />
      <CharacterBulkImport />
    </div>
  );
}
