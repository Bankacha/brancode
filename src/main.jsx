import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.jsx";
import AuthGate from "./auth/AuthGate.jsx";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/dm-sans/opsz.css";
import "@fontsource/dm-mono/500.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate>{(session) => <App session={session} />}</AuthGate>
    </BrowserRouter>
  </React.StrictMode>
);
