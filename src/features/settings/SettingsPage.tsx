import { ExportImportPanel } from "./ExportImportPanel";
import { AppSettingsPanel } from "./AppSettingsPanel";
import { CsvImportPanel } from "./CsvImportPanel";

export function SettingsPage() {
  return (
    <div className="page">
      <AppSettingsPanel />
      <CsvImportPanel />
      <ExportImportPanel />
    </div>
  );
}
