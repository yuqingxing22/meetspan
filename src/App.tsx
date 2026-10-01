import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { isFirebaseConfigured } from "./firebase";
import AccountMenu from "./components/AccountMenu";
import YourPollsMenu from "./components/YourPollsMenu";
import Icon from "./components/Icon";
import markUrl from "./assets/meetspan-mark.svg";

export default function App() {
  const { pathname } = useLocation();
  // Promote the app on shared pages (invite / organizer) — but not on the
  // home page, which already *is* the create form.
  const showCta = pathname !== "/";

  // A new page starts at the top (the router keeps the old scroll position).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
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
              <span className="hide-narrow">New poll</span>
            </Link>
          )}
          <AccountMenu />
        </div>
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
        <span className="footer-brand">MeetSpan</span>
        <span>No sign-up · Share-link only · Your times stay in your timezone</span>
      </footer>
    </div>
  );
}
