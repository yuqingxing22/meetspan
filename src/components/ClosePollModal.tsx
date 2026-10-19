import { t } from "../lib/i18n";

interface Props {
  title: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks the organizer to confirm before a poll stops taking answers. */
export default function ClosePollModal({ title, busy, onCancel, onConfirm }: Props) {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="modal modal-narrow"
        role="alertdialog"
        aria-label={t("Close this poll?")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !busy && onCancel()}
      >
        <div className="modal-head">
          <h2>{t("Close this poll?")}</h2>
        </div>
        <p className="modal-text">
          {t("“{title}” will stop taking answers: guests can still see it, but can't add or change their times.", {
            title: title || t("Untitled poll"),
          })}
        </p>
        <p className="hint">{t("Nothing is deleted. You can reopen the poll any time.")}</p>
        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" autoFocus disabled={busy} onClick={onConfirm}>
            {busy ? t("Closing…") : t("Close poll")}
          </button>
        </div>
      </div>
    </div>
  );
}
