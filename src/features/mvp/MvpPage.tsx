import { useState } from "react";
import { MvpKillForm } from "./MvpKillForm";
import { MvpKillList } from "./MvpKillList";
import { MvpStats } from "./MvpStats";
import { Modal } from "../../components/Modal";
import type { MvpKill } from "../../db/types";

export function MvpPage() {
  const [dialogState, setDialogState] = useState<
    { open: false } | { open: true; editing: MvpKill | null }
  >({ open: false });

  return (
    <div className="page">
      <section className="panel">
        <h2>MVPカウンター</h2>
        <div className="form-actions">
          <button
            type="button"
            onClick={() => setDialogState({ open: true, editing: null })}
          >
            討伐を記録する
          </button>
        </div>
      </section>
      <MvpStats />
      <MvpKillList
        onEdit={(kill) => setDialogState({ open: true, editing: kill })}
      />
      <Modal
        open={dialogState.open}
        onClose={() => setDialogState({ open: false })}
      >
        {dialogState.open && (
          <MvpKillForm
            editingKill={dialogState.editing}
            onDone={() => setDialogState({ open: false })}
          />
        )}
      </Modal>
    </div>
  );
}
