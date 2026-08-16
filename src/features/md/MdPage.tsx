import { useState } from "react";
import { MdGrid, type MdRecordTarget } from "./MdGrid";
import { MdRunForm } from "./MdRunForm";
import { MdRunList } from "./MdRunList";
import { Modal } from "../../components/Modal";
import type { MdRun } from "../../db/types";

interface Props {
  pendingRecordTarget?: MdRecordTarget | null;
  onConsumeRecordTarget?: () => void;
}

export function MdPage({ pendingRecordTarget, onConsumeRecordTarget }: Props) {
  const [editingRun, setEditingRun] = useState<MdRun | null>(null);

  return (
    <div className="page fill-page">
      <MdGrid
        pendingRecordTarget={pendingRecordTarget}
        onConsumeRecordTarget={onConsumeRecordTarget}
      />
      <details className="panel">
        <summary>周回履歴</summary>
        <MdRunList onEdit={setEditingRun} />
      </details>
      <Modal open={editingRun !== null} onClose={() => setEditingRun(null)}>
        <MdRunForm editingRun={editingRun} onDone={() => setEditingRun(null)} />
      </Modal>
    </div>
  );
}
