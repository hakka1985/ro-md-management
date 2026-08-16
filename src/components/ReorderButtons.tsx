interface Props {
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** Up/down buttons alongside drag-and-drop reordering — HTML5 drag doesn't work on touch devices, so this is the mobile-friendly fallback for every draggable-row table in the app. */
export function ReorderButtons({
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: Props) {
  return (
    <span className="reorder-buttons">
      <button type="button" onClick={onMoveUp} disabled={!canMoveUp} title="上へ移動">
        ▲
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title="下へ移動"
      >
        ▼
      </button>
    </span>
  );
}
