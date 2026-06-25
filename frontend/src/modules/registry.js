// Central registry of all 7 AERA modules.
// To unlock a locked module: change status to "active" and set dataUrl to its data source.
// The dashboard reads this file — nothing else needs to change.

const modules = [
  {
    id: "research",
    label: "Research",
    description: "AERA-Analysen & Gegencheck-Status",
    status: "active",
    dataUrl: "/research_log.json",
    route: "/research",
    accentColor: "#00e5ff",
  },
  {
    id: "validierung",
    label: "Validierung",
    description: "Pre-Trade & Daten-Qualitäts-Checks",
    status: "active",
    dataUrl: "/validation_log.json",
    route: "/validierung",
    accentColor: "#69ff47",
  },
  {
    id: "strategie",
    label: "Strategie-Engine",
    description: "Folgt in Monat 2",
    status: "locked",
    dataUrl: null,
    route: null,
    accentColor: "#7c83a0",
  },
  {
    id: "trading",
    label: "Trading",
    description: "Folgt nach IBKR-Anbindung",
    status: "locked",
    dataUrl: null,
    route: null,
    accentColor: "#7c83a0",
  },
  {
    id: "freigabe",
    label: "Team-Freigabe",
    description: "Folgt mit Strategie-Engine",
    status: "locked",
    dataUrl: null,
    route: null,
    accentColor: "#7c83a0",
  },
  {
    id: "kontrolle",
    label: "Kontroll-Loop",
    description: "Folgt mit Live-System",
    status: "locked",
    dataUrl: null,
    route: null,
    accentColor: "#7c83a0",
  },
  {
    id: "uebersicht",
    label: "Übersicht",
    description: "Folgt als letzter Ausbauschritt",
    status: "locked",
    dataUrl: null,
    route: null,
    accentColor: "#7c83a0",
  },
];

export default modules;
