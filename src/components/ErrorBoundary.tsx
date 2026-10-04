import { Component, type ReactNode } from "react";
import { reportError } from "../lib/errorReport";
import { t } from "../lib/i18n";

/**
 * If a page crashes while rendering, show a short apology with a reload button
 * instead of a blank screen, and report the error.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <h1>{t("Something went wrong")}</h1>
        <p>{t("Sorry, this page hit an error. Reloading usually fixes it; your saved times are safe.")}</p>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
          {t("Reload")}
        </button>
        <p className="crash-help">
          {t("Still not working? Email")} <a href="mailto:support@meetspan.app">support@meetspan.app</a>
        </p>
      </div>
    );
  }
}
