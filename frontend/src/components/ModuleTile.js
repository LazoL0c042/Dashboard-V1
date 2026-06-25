import React from "react";
import { useNavigate } from "react-router-dom";

function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function ModuleTile({ module }) {
  const navigate = useNavigate();
  const isActive = module.status === "active";

  const handleClick = () => {
    if (isActive) navigate(module.route);
  };

  return (
    <div
      className={`module-tile ${isActive ? "module-tile--active" : "module-tile--locked"}`}
      style={isActive ? { "--accent": module.accentColor } : {}}
      onClick={handleClick}
      role={isActive ? "button" : undefined}
      tabIndex={isActive ? 0 : undefined}
      onKeyDown={isActive ? (e) => e.key === "Enter" && handleClick() : undefined}
    >
      <div className="module-tile__accent-ring" />
      <div className="module-tile__content">
        <h2 className="module-tile__label">{module.label}</h2>
        <p className="module-tile__description">{module.description}</p>
        {!isActive && (
          <div className="module-tile__lock">
            <LockIcon />
          </div>
        )}
        {isActive && (
          <span className="module-tile__badge">AKTIV</span>
        )}
      </div>
    </div>
  );
}
