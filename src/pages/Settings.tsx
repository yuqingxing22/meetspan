import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DateTime } from "luxon";
import Icon from "../components/Icon";
import PollList from "../components/PollList";
import TimezonePicker from "../components/TimezonePicker";
import MySchedule from "./MySchedule";
import SettingsTemplates from "./SettingsTemplates";
import {
  ACCENTS,
  DEFAULT_PREFS,
  TEXT_SIZES,
  setPrefs,
  usePrefs,
  type Accent,
  type Clock,
  type TextSize,
} from "../lib/prefs";
import { useMyPolls } from "../lib/useMyPolls";
import { googleFirstName, useUser } from "../lib/useUser";
import { useToast } from "../lib/useToast";
import { isFirebaseConfigured, signInWithGoogle } from "../firebase";
import { t, useLang } from "../lib/i18n";
import { startTour } from "../components/Tour";

type Tab = "prefs" | "schedule" | "templates" | "polls";

const TABS: { id: Tab; label: string }[] = [
  { id: "prefs", label: "Preferences" },
  { id: "schedule", label: "My schedule" },
  { id: "templates", label: "Email templates" },
  { id: "polls", label: "Your polls" },
];

const ACCENT_LABELS: Record<Accent, string> = {
  indigo: "Indigo",
  blue: "Blue",
  teal: "Teal",
  violet: "Violet",
  rose: "Rose",
};

const SIZE_LABELS: Record<TextSize, string> = {
  sm: "Small",
  md: "Default",
  lg: "Large",
  xl: "Extra large",
};

const CLOCKS: { id: Clock; label: string }[] = [
  { id: "auto", label: "Automatic" },
  { id: "12", label: "12-hour" },
  { id: "24", label: "24-hour" },
];

const shortHour = (h: number) => DateTime.fromObject({ hour: h % 24 }).toFormat("h a");

/** Settings: look and feel, remembered choices, the weekly schedule, and every poll. */
export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((x) => x.id === params.get("tab")) ? (params.get("tab") as Tab) : "prefs";

  return (
    <div className="settings-page">
      <div className="page-head">
        <h1 className="page-title">{t("Settings")}</h1>
      </div>
      <div className="settings-tabs" role="tablist" aria-label={t("Settings")}>
        {TABS.map((x) => (
          <button
            type="button"
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            className={tab === x.id ? "active" : ""}
            onClick={() => setParams(x.id === "prefs" ? {} : { tab: x.id }, { replace: true })}
          >
            {t(x.label)}
          </button>
        ))}
      </div>
      {tab === "prefs" && <Preferences />}
      {tab === "schedule" && <MySchedule embedded />}
      {tab === "templates" && <SettingsTemplates />}
      {tab === "polls" && <AllPolls />}
    </div>
  );
}

/** One settings line: the name (and an optional note) on the left, the control on the right. */
function Row({ id, label, note, children }: { id: string; label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-name">
        <span id={id}>{label}</span>
        {note && <span className="setting-note">{note}</span>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function Preferences() {
  const prefs = usePrefs();
  const [lang, setLang] = useLang();
  const user = useUser();
  const nav = useNavigate();
  const signedIn = !!user && !user.isAnonymous;

  return (
    <div className="settings-stack">
      <section className="card settings-card">
        <h2>{t("About you")}</h2>
        <Row
          id="name-label"
          label={t("What should we call you?")}
          note={t("Filled in as your name when you create or answer a poll. You can still change it for one poll.")}
        >
          <input
            type="text"
            className="setting-input"
            aria-labelledby="name-label"
            value={prefs.name}
            maxLength={80}
            placeholder={googleFirstName(user) || t("e.g. Alex")}
            onChange={(e) => setPrefs({ name: e.target.value })}
            onBlur={(e) => e.target.value !== e.target.value.trim() && setPrefs({ name: e.target.value.trim() })}
          />
        </Row>
      </section>

      <section className="card settings-card">
        <h2>{t("Appearance")}</h2>
        <Row id="accent-label" label={t("Theme color")}>
          <div className="swatches" role="radiogroup" aria-labelledby="accent-label">
            {ACCENTS.map((a) => (
              <button
                type="button"
                key={a}
                role="radio"
                aria-checked={prefs.accent === a}
                className={`swatch-btn${prefs.accent === a ? " on" : ""}`}
                data-swatch={a}
                title={t(ACCENT_LABELS[a])}
                onClick={() => setPrefs({ accent: a })}
              >
                <span className="swatch-dot" />
                <span className="swatch-name">{t(ACCENT_LABELS[a])}</span>
              </button>
            ))}
          </div>
        </Row>
        <Row id="size-label" label={t("Text size")}>
          <div className="seg" role="radiogroup" aria-labelledby="size-label">
            {TEXT_SIZES.map((s) => (
              <button
                type="button"
                key={s}
                role="radio"
                aria-checked={prefs.textSize === s}
                className={prefs.textSize === s ? "active" : ""}
                onClick={() => setPrefs({ textSize: s })}
              >
                {t(SIZE_LABELS[s])}
              </button>
            ))}
          </div>
        </Row>
      </section>

      <section className="card settings-card">
        <h2>{t("Language and time")}</h2>
        <Row id="lang-label" label={t("Language")}>
          <div className="seg" role="radiogroup" aria-labelledby="lang-label">
            <button type="button" role="radio" aria-checked={lang === "en"} className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
              English
            </button>
            <button type="button" role="radio" aria-checked={lang === "zh"} className={lang === "zh" ? "active" : ""} onClick={() => setLang("zh")}>
              中文
            </button>
          </div>
        </Row>
        <Row id="clock-label" label={t("Time format")} note={t("Now: {time}", { time: DateTime.now().toFormat("h:mm a") })}>
          <div className="seg" role="radiogroup" aria-labelledby="clock-label">
            {CLOCKS.map((c) => (
              <button
                type="button"
                key={c.id}
                role="radio"
                aria-checked={prefs.clock === c.id}
                className={prefs.clock === c.id ? "active" : ""}
                onClick={() => setPrefs({ clock: c.id })}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
        </Row>
        <Row id="week-label" label={t("Calendars start on")}>
          <div className="seg" role="radiogroup" aria-labelledby="week-label">
            {([0, 1] as const).map((d) => (
              <button
                type="button"
                key={d}
                role="radio"
                aria-checked={prefs.weekStart === d}
                className={prefs.weekStart === d ? "active" : ""}
                onClick={() => setPrefs({ weekStart: d })}
              >
                {t(d === 0 ? "Sunday" : "Monday")}
              </button>
            ))}
          </div>
        </Row>
        <Row id="tz-label" label={t("Timezone for new polls")} note={t("MeetSpan fills this in with the timezone you picked last.")}>
          <div className="settings-tz">
            <TimezonePicker
              id="settings-tz"
              value={prefs.tz}
              onChange={(tz) => setPrefs({ tz })}
              placeholder={t("Not set: new polls start with this device's timezone")}
            />
            {prefs.tz && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPrefs({ tz: "" })}>
                {t("Clear")}
              </button>
            )}
          </div>
        </Row>
      </section>

      <section className="card settings-card">
        <h2>{t("Recent custom hours")}</h2>
        <Row
          id="hours-label"
          label={t("Saved hours")}
          note={t("The last 3 custom hours you used for a poll show up under “What hours?” on the create page.")}
        >
          {prefs.customHours.length === 0 ? (
            <span className="setting-empty">{t("None yet. Pick “Custom” hours when you create a poll.")}</span>
          ) : (
            <div className="chips">
              {prefs.customHours.map((h) => (
                <button
                  type="button"
                  key={`${h.start}-${h.end}`}
                  className="chip on"
                  aria-label={t("Remove {name}", { name: `${shortHour(h.start)} – ${shortHour(h.end)}` })}
                  onClick={() =>
                    setPrefs({ customHours: prefs.customHours.filter((x) => x.start !== h.start || x.end !== h.end) })
                  }
                >
                  {shortHour(h.start)} – {shortHour(h.end)} <Icon name="x" size={14} />
                </button>
              ))}
            </div>
          )}
        </Row>
      </section>

      <section className="card settings-card">
        <h2>{t("Help and sync")}</h2>
        <Row id="tour-label" label={t("Tutorial")} note={t("A short walk through the create page.")}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              nav("/");
              startTour();
            }}
          >
            <Icon name="help" /> {t("Show the tutorial")}
          </button>
        </Row>
        <Row id="reset-label" label={t("Reset")} note={t("Theme color, text size, time format and week start go back to the defaults.")}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setPrefs({ ...DEFAULT_PREFS, tz: prefs.tz, customHours: prefs.customHours })}
          >
            {t("Reset look and time settings")}
          </button>
        </Row>
        {isFirebaseConfigured && (
          <Row id="sync-label" label={t("Sync")}>
            <p className="settings-sync">
              <Icon name={signedIn ? "check" : "user"} className="icon-brand" />
              <span>
                {signedIn ? (
                  t("These settings are saved to your Google account and follow you to other devices.")
                ) : (
                  <>
                    {t("Saved in this browser.")}{" "}
                    <button type="button" className="link-btn link-inline" onClick={() => signInWithGoogle().catch(() => {})}>
                      {t("Sign in with Google")}
                    </button>{" "}
                    {t("to use them on your other devices.")}
                  </>
                )}
              </span>
            </p>
          </Row>
        )}
      </section>
    </div>
  );
}

function AllPolls() {
  const { polls, refresh } = useMyPolls();
  const { show, node } = useToast();
  const nav = useNavigate();
  return (
    <section className="card">
      <div className="settings-section-head">
        <h2>{t("Your polls")}</h2>
        <span className="muted small">{t(polls.length === 1 ? "1 poll" : "{n} polls", { n: polls.length })}</span>
      </div>
      {polls.length === 0 ? (
        <div className="empty-box">{t("No polls yet. Polls you create show up here.")}</div>
      ) : (
        <PollList
          polls={polls}
          selecting
          onOpen={(p) => nav(p.token ? `/o/${p.pollId}?k=${p.token}` : `/o/${p.pollId}`)}
          onChanged={refresh}
          onMessage={show}
        />
      )}
      {node}
    </section>
  );
}
