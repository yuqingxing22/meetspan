import { useState } from "react";
import { DateTime } from "luxon";
import Icon from "./Icon";
import { closePolls, deletePolls, type BatchResult, type MyPollEntry } from "../lib/useMyPolls";
import { mailerEnabled } from "../lib/mailer";
import { t } from "../lib/i18n";

interface Props {
  polls: MyPollEntry[];
  onOpen: (p: MyPollEntry) => void;
  /** Called after a batch action so the list can be re-read. */
  onChanged: () => void;
  /** Toast-style message after a batch action. */
  onMessage: (msg: string) => void;
  /** Start in selection mode (the Settings page shows checkboxes right away). */
  selecting?: boolean;
  /** "Batch actions" goes here instead of selecting in place (the menu sends people to Settings). */
  onBatch?: () => void;
}

/**
 * The organizer's polls, with an optional selection mode for closing or
 * deleting several at once. Used by the "Your polls" menu and Settings.
 */
export default function PollList({ polls, onOpen, onChanged, onMessage, selecting: alwaysSelecting = false, onBatch }: Props) {
  const [selecting, setSelecting] = useState(alwaysSelecting);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Which batch action is waiting for a yes.
  const [confirming, setConfirming] = useState<"close" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = polls.filter((p) => picked.has(p.pollId));
  const openChosen = chosen.filter((p) => p.status !== "closed");
  const allPicked = polls.length > 0 && chosen.length === polls.length;

  function toggle(id: string) {
    setConfirming(null);
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setPicked(new Set());
    setConfirming(null);
    if (!alwaysSelecting) setSelecting(false);
  }

  async function run(action: "close" | "delete") {
    setBusy(true);
    let r: BatchResult;
    try {
      r = action === "close" ? await closePolls(openChosen) : await deletePolls(chosen);
    } finally {
      setBusy(false);
    }
    const key =
      action === "close"
        ? r.done === 1
          ? "Closed 1 poll"
          : "Closed {n} polls"
        : r.done === 1
        ? "Deleted 1 poll"
        : "Deleted {n} polls";
    onMessage(
      r.failed > 0
        ? `${t(key, { n: r.done })} · ${t("{n} couldn't be changed. Please try again.", { n: r.failed })}`
        : t(key, { n: r.done })
    );
    stopSelecting();
    onChanged();
  }

  return (
    <div className={`poll-list${selecting ? " selecting" : ""}`}>
      {selecting && polls.length > 0 && (
        <label className="poll-list-all">
          <input
            type="checkbox"
            checked={allPicked}
            onChange={() => setPicked(allPicked ? new Set() : new Set(polls.map((p) => p.pollId)))}
          />
          {t("Select all")}
          {chosen.length > 0 && <span className="muted small">{t("{n} selected", { n: chosen.length })}</span>}
        </label>
      )}
      {polls.map((p) => (
        <div key={p.pollId} className={`mypoll${picked.has(p.pollId) ? " picked" : ""}`}>
          {selecting && (
            <input
              type="checkbox"
              className="mypoll-check"
              checked={picked.has(p.pollId)}
              aria-label={t("Select {name}", { name: p.title || t("Untitled poll") })}
              onChange={() => toggle(p.pollId)}
            />
          )}
          <button
            type="button"
            className="mypoll-open"
            onClick={() => (selecting ? toggle(p.pollId) : onOpen(p))}
          >
            <span className="mypoll-title">{p.title || t("Untitled poll")}</span>
            <span className="mypoll-date">
              {p.status === "closed" && <span className="mypoll-status">{t("Closed")}</span>}
              {DateTime.fromMillis(p.createdAt).toFormat("LLL d, yyyy")}
            </span>
          </button>
          {selecting && (
            <button
              type="button"
              className="icon-btn mypoll-go"
              aria-label={t("Open {name}", { name: p.title || t("Untitled poll") })}
              onClick={() => onOpen(p)}
            >
              <Icon name="arrowRight" size={14} />
            </button>
          )}
        </div>
      ))}

      {selecting ? (
        confirming ? (
          <div className="batch-bar batch-confirm" role="alert">
            <span>
              {confirming === "delete"
                ? t(
                    chosen.length === 1
                      ? "Delete 1 poll with all its replies? This can't be undone."
                      : "Delete {n} polls with all their replies? This can't be undone.",
                    { n: chosen.length }
                  )
                : t(
                    openChosen.length === 1
                      ? "Close 1 poll? Guests can't add or change their times until you reopen it."
                      : "Close {n} polls? Guests can't add or change their times until you reopen them.",
                    { n: openChosen.length }
                  )}
            </span>
            <div className="btn-row">
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setConfirming(null)}>
                {t("Cancel")}
              </button>
              {confirming === "delete" ? (
                <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => run("delete")}>
                  {busy ? t("Deleting…") : t("Delete")}
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => run("close")}>
                  {busy ? t("Closing…") : t("Close")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="batch-bar">
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy || openChosen.length === 0}
              title={chosen.length > 0 && openChosen.length === 0 ? t("These polls are already closed") : undefined}
              onClick={() => setConfirming("close")}
            >
              <Icon name="lock" size={14} />
              {openChosen.length > 0 ? t("Close {n}", { n: openChosen.length }) : t("Close")}
            </button>
            {mailerEnabled && (
              <button
                type="button"
                className="btn btn-sm btn-danger-ghost"
                disabled={busy || chosen.length === 0}
                onClick={() => setConfirming("delete")}
              >
                <Icon name="trash" size={14} />
                {chosen.length > 0 ? t("Delete {n}", { n: chosen.length }) : t("Delete")}
              </button>
            )}
            {!alwaysSelecting && (
              <button type="button" className="btn btn-sm btn-ghost batch-done" onClick={stopSelecting}>
                {t("Done")}
              </button>
            )}
          </div>
        )
      ) : (
        polls.length > 0 && (
          <button type="button" className="menu-link batch-start" onClick={() => (onBatch ? onBatch() : setSelecting(true))}>
            <Icon name="list" size={14} /> {t("Batch actions")}
          </button>
        )
      )}
    </div>
  );
}
