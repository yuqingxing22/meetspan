import { useNavigate, useSearchParams } from "react-router-dom";
import { DateTime } from "luxon";
import Icon from "../components/Icon";
import PollList from "../components/PollList";
import TimezonePicker from "../components/TimezonePicker";
import MySchedule from "./MySchedule";
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
import { useUser } from "../lib/useUser";
import { useToast } from "../lib/useToast";
import { isFirebaseConfigured, signInWithGoogle } from "../firebase";
import { t, useLang } from "../lib/i18n";
import { startTour } from "../components/Tour";

type Tab = "prefs" | "schedule" | "polls";

const TABS: { id: Tab; label: string }[] = [
  { id: "prefs", label: "Preferences" },
  { id: "schedule", label: "My schedule" },
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
    <div>
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
      {tab === "polls" && <AllPolls />}
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
    <div className="settings-grid">
      <section className="card">
        <h2>{t("Appearance")}</h2>
        <div className="field">
          <span className="field-label" id="accent-label">{t("Theme color")}</span>
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
        </div>
        <div className="field">
          <span className="field-label" id="size-label">{t("Text size")}</span>
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
        </div>
      </section>

      <section className="card">
        <h2>{t("Language and time")}</h2>
        <div className="field">
          <span className="field-label" id="lang-label">{t("Language")}</span>
          <div className="seg" role="radiogroup" aria-labelledby="lang-label">
            <button type="button" role="radio" aria-checked={lang === "en"} className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
              English
            </button>
            <button type="button" role="radio" aria-checked={lang === "zh"} className={lang === "zh" ? "active" : ""} onClick={() => setLang("zh")}>
              中文
            </button>
          </div>
        </div>
        <div className="field">
          <span className="field-label" id="clock-label">{t("Time format")}</span>
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
          <span className="hint">{t("Now: {time}", { time: DateTime.now().toFormat("h:mm a") })}</span>
        </div>
        <div className="field">
          <span className="field-label" id="week-label">{t("Calendars start on")}</span>
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
        </div>
        <div className="settings-tz">
          <TimezonePicker
            id="settings-tz"
            value={prefs.tz}
            onChange={(tz) => setPrefs({ tz })}
            label={t("Timezone for new polls")}
            placeholder={t("Not set: new polls start with this device's timezone")}
          />
          {prefs.tz && (
            <button type="button" className="link-btn" onClick={() => setPrefs({ tz: "" })}>
              {t("Clear")}
            </button>
          )}
        </div>
        <p className="hint">{t("MeetSpan fills this in with the timezone you picked last.")}</p>
      </section>

      <section className="card">
        <h2>{t("Recent custom hours")}</h2>
        <p className="hint">{t("The last 3 custom hours you used for a poll show up under “What hours?” on the create page.")}</p>
        {prefs.customHours.length === 0 ? (
          <div className="empty-box empty-box-sm">{t("None yet. Pick “Custom” hours when you create a poll.")}</div>
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
      </section>

      <section className="card">
        <h2>{t("Help and sync")}</h2>
        <div className="settings-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              nav("/");
              startTour();
            }}
          >
            <Icon name="help" /> {t("Show the tutorial")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPrefs({ ...DEFAULT_PREFS, tz: prefs.tz, customHours: prefs.customHours })}
          >
            {t("Reset look and time settings")}
          </button>
        </div>
        {isFirebaseConfigured && (
          <p className="hint settings-sync">
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
