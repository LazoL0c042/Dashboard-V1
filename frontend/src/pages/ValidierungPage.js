import React from "react";
import { useNavigate } from "react-router-dom";
import { useModuleData } from "../modules/useModuleData";

const STATUS_COLORS = {
  bestanden: "#69ff47",
  blockiert: "#ff6d6d",
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

export default function ValidierungPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useModuleData("/validation_log.json");

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate("/")}>← Command Center</button>
      <h1 className="page__title" style={{ color: "#69ff47" }}>Validierung</h1>
      <p className="page__subtitle">Pre-Trade & Daten-Qualitäts-Checks</p>

      {loading && <p className="status-msg">Lade Daten…</p>}
      {error && <p className="status-msg status-msg--error">Fehler: {error}</p>}

      {!loading && !error && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>Check-Typ</th>
              <th>Ziel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, i) => (
              <tr key={i}>
                <td className="mono">{formatTimestamp(entry.timestamp)}</td>
                <td>{entry.check_type}</td>
                <td>{entry.target}</td>
                <td>
                  <span className="badge" style={{ borderColor: STATUS_COLORS[entry.status] || "#7c83a0", color: STATUS_COLORS[entry.status] || "#7c83a0" }}>
                    {entry.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
