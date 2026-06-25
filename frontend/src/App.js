import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CommandCenter from "./pages/CommandCenter";
import ResearchPage from "./pages/ResearchPage";
import ValidierungPage from "./pages/ValidierungPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/validierung" element={<ValidierungPage />} />
      </Routes>
    </BrowserRouter>
  );
}
