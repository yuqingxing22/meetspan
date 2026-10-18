import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { isFirebaseConfigured } from "./firebase";
import AccountMenu from "./components/AccountMenu";
import YourPollsMenu from "./components/YourPollsMenu";
import Icon from "./components/Icon";
import Tour, { TOUR_EVENT, startTour } from "./components/Tour";
import { usePrefs } from "./lib/prefs";
import { startPrefsSync } from "./lib/prefsSync";
import { t, useLang } from "./lib/i18n";
import markUrl from "./assets/meetspan-mark.svg";

export default function App() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [lang, setLang] = useLang();
  const { clock } = usePrefs();
  const [touring, setTouring] = useState(false);

  useEffect(() => startPrefsSync(), []);

  // The tutorial walks through the create form on the home page.
  useEffect(() => {
    const onTour = () => setTouring(true);
    window.addEventListener(TOUR_EVENT, onTour);
    return () => window.removeEventListener(TOUR_EVENT, onTour);
  }, []);
  useEffect(() => {
    if (pathname !== "/") setTouring(false);
  }, [pathname]);
  // Promote the app on shared pages (invite / organizer) — but not on the
  // home page, which already *is* the create form.
  const showCta = pathname !== "/";

  // A new page starts at the top (the router keeps the old scroll position).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    // Keyed by language and clock so every page re-renders its text and dates.
    <div className="app" key={`${lang}-${clock}`}>
      <header className="topbar">
        <Link to="/" className="brand">
          <img className="brand-mark" src={markUrl} alt="" width={30} height={30} />
          MeetSpan
        </Link>
        <div className="topbar-right">
          <YourPollsMenu />
          {showCta && (
            <Link to="/" className="btn btn-sm">
              <Icon name="plus" />
              <span className="hide-narrow">{t("New poll")}</span>
            </Link>
          )}
          <AccountMenu />
          <Link
            to="/settings"
            className={`btn btn-sm icon-only${pathname === "/settings" ? " active" : ""}`}
            aria-label={t("Settings")}
            title={t("Settings")}
            data-tour="settings"
          >
            <Icon name="settings" />
          </Link>
          <button
            type="button"
            className="btn btn-sm"
            aria-label={t("Tutorial")}
            title={t("Tutorial")}
            onClick={() => {
              if (pathname !== "/") nav("/");
              startTour();
            }}
          >
            <Icon name="help" />
            <span className="hide-narrow">{t("Tutorial")}</span>
          </button>
          <button
            type="button"
            className="btn btn-sm lang-toggle"
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}
            title={lang === "zh" ? "Switch to English" : "切换到中文"}
          >
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      {!isFirebaseConfigured && (
        <div className="banner banner-warn">
          {t("Firebase isn't configured yet. Copy .env.example to .env and fill in your Firebase web config (see README.md). Until then, creating and joining polls won't work.")}
        </div>
      )}

      <main className="content">
        <Outlet />
      </main>
      {touring && pathname === "/" && <Tour onClose={() => setTouring(false)} />}

      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brandcol">
            <Link to="/" className="footer-logo">
              <img src={markUrl} alt="" width={24} height={24} />
              MeetSpan
            </Link>
            <p>{t("No sign-up · Share-link only · Your times stay in your timezone")}</p>
          </div>
          <nav className="footer-col" aria-label={t("Help")}>
            <h2>{t("Help")}</h2>
            <Link to="/faq">{t("FAQ")}</Link>
            <Link to="/support">{t("Support")}</Link>
          </nav>
          <nav className="footer-col" aria-label={t("Company")}>
            <h2>{t("Company")}</h2>
            <Link to="/about">{t("About MeetSpan")}</Link>
            <Link to="/privacy">{t("Privacy policy")}</Link>
            <Link to="/terms">{t("Terms of use")}</Link>
          </nav>
        </div>
        <p className="footer-feedback">
          {t("How was your experience? Give feedback about our website:")}{" "}
          <a href="mailto:hello@meetspan.app?subject=MeetSpan%20feedback">hello@meetspan.app</a>
        </p>
        <p className="footer-copy">{t("© {year} MeetSpan. All rights reserved.", { year: String(new Date().getFullYear()) })}</p>
      </footer>
    </div>
  );
}
