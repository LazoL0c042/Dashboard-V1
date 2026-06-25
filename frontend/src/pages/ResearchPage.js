import React from "react";
import { useNavigate } from "react-router-dom";
import { useModuleData } from "../modules/useModuleData";

const TIER_COLORS = {
  "Tier 1": "#00e5ff",
  "Tier 2": "#ffd740",
  "Tier 3": "#ff6d6d",
};

const STATUS_COLORS = {
  bestätigt: "#69ff47",
  offen: "#ffd740",
  abgelehnt: "#ff6d6d",
};

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ResearchPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useModuleData("/research_log.json");

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate("/")}>← Command Center</button>
      <h1 className="page__title" style={{ color: "#00e5ff" }}>Research</h1>
      <p className="page__subtitle">AERA-Analysen & Gegencheck-Ergebnisse</p>

      {loading && <p className="status-msg">Lade Daten…</p>}
      {error && <p className="status-msg status-msg--error">Fehler: {error}</p>}

      {!loading && !error && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>Analyse</th>
              <th>Tier</th>
              <th>Gegencheck</th>
              <th>Konfidenz</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, i) => (
              <tr key={i}>
                <td className="mono">{formatTimestamp(entry.timestamp)}</td>
                <td>{entry.headline}</td>
                <td>
                  <span className="badge" style={{ borderColor: TIER_COLORS[entry.tier] || "#7c83a0", color: TIER_COLORS[entry.tier] || "#7c83a0" }}>
                    {entry.tier}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{ borderColor: STATUS_COLORS[entry.gegencheck_status] || "#7c83a0", color: STATUS_COLORS[entry.gegencheck_status] || "#7c83a0" }}>
                    {entry.gegencheck_status}
                  </span>
                </td>
                <td>{entry.konfidenz}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
