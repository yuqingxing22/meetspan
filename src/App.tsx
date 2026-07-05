import { Link, Outlet, useLocation } from "react-router-dom";
import { isFirebaseConfigured } from "./firebase";
import markUrl from "./assets/meetspan-mark.svg";

export default function App() {
  const { pathname } = useLocation();
  // Promote the app on shared pages (invite / organizer) — but not on the
  // home page, which already *is* the create form.
  const showCta = pathname !== "/";

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img className="brand-mark" src={markUrl} alt="" width={22} height={22} />{" "}
          MeetSpan
        </Link>
        <span className="tagline">Find a time across timezones</span>
        {showCta && (
          <Link to="/" className="btn btn-primary btn-sm topbar-cta">
            ＋ Create my own poll
          </Link>
        )}
      </header>

      {!isFirebaseConfigured && (
        <div className="banner banner-warn">
          Firebase isn't configured yet. Copy <code>.env.example</code> to{" "}
          <code>.env</code> and fill in your Firebase web config (see{" "}
          <code>README.md</code>). Until then, creating and joining polls won't
          work.
        </div>
      )}

      <main className="content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <img className="brand-mark" src={markUrl} alt="" width={20} height={20} />{" "}
          MeetSpan
        </div>
        <div className="footer-tag">
          No sign-up · share-link only · your times stay in your own timezone
        </div>
      </footer>
    </div>
  );
}
