import "./lib/i18n"; // first: localizes date formatting before anything renders
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import Participate from "./pages/Participate";
import Organizer from "./pages/Organizer";
import MySchedule from "./pages/MySchedule";
import Privacy from "./pages/Privacy";
import Faq from "./pages/Faq";
import Support from "./pages/Support";
import About from "./pages/About";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* HashRouter keeps deep links (#/p/<id>) working on GitHub Pages,
        which has no SPA server-side fallback. */}
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="p/:pollId" element={<Participate />} />
          <Route path="o/:pollId" element={<Organizer />} />
          <Route path="schedule" element={<MySchedule />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="faq" element={<Faq />} />
          <Route path="support" element={<Support />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
