import React from "react";
import modules from "../modules/registry";
import ModuleTile from "../components/ModuleTile";

export default function CommandCenter() {
  return (
    <div className="command-center">
      <header className="cc-header">
        <div className="cc-header__logo">AERA</div>
        <h1 className="cc-header__title">Command Center</h1>
        <p className="cc-header__sub">Trading Fund Operations Dashboard</p>
      </header>

      <div className="tile-grid">
        {modules.map((mod) => (
          <ModuleTile key={mod.id} module={mod} />
        ))}
      </div>

      <footer className="cc-footer">
        {modules.filter((m) => m.status === "active").length} von {modules.length} Modulen aktiv
      </footer>
    </div>
  );
}
