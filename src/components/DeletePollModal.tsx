import { t } from "../lib/i18n";

interface Props {
  title: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks the organizer to confirm before a poll is deleted for good. */
export default function DeletePollModal({ title, busy, error, onCancel, onConfirm }: Props) {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="modal modal-narrow"
        role="alertdialog"
        aria-label={t("Delete this poll?")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{t("Delete this poll?")}</h2>
        </div>
        <p className="modal-text">
          {t("“{title}” will be deleted for good, along with everyone's replies and any email addresses they left. This can't be undone.", {
            title: title || t("Untitled poll"),
          })}
        </p>
        <p className="hint">{t("If you only want to stop new replies, use “Close poll” instead.")}</p>
        {error && <p className="error-text">{error}</p>}
        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={onConfirm}>
            {busy ? t("Deleting…") : t("Delete poll")}
          </button>
        </div>
      </div>
    </div>
  );
}
