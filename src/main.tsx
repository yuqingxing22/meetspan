import "./lib/i18n"; // first: localizes date formatting before anything renders
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Routes, Route } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import Participate from "./pages/Participate";
import Organizer from "./pages/Organizer";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import Faq from "./pages/Faq";
import Support from "./pages/Support";
import About from "./pages/About";
import Terms from "./pages/Terms";
import ErrorBoundary from "./components/ErrorBoundary";
import { installErrorReporting } from "./lib/errorReport";
import "./fonts.css";
import "./styles.css";

installErrorReporting();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* HashRouter keeps deep links (#/p/<id>) working on GitHub Pages,
          which has no SPA server-side fallback. */}
      <HashRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<Home />} />
            <Route path="p/:pollId" element={<Participate />} />
            <Route path="o/:pollId" element={<Organizer />} />
            <Route path="settings" element={<Settings />} />
            {/* "My schedule" moved into Settings; old links still work. */}
            <Route path="schedule" element={<Navigate to="/settings?tab=schedule" replace />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="faq" element={<Faq />} />
            <Route path="support" element={<Support />} />
            <Route path="about" element={<About />} />
            <Route path="terms" element={<Terms />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
