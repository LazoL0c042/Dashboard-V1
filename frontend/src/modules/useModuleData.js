import { useState, useEffect } from "react";

// Generic hook: fetch JSON from a module's dataUrl.
// Returns { data, loading, error } — same shape for every module.
export function useModuleData(dataUrl) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dataUrl) {
      setLoading(false);
      return;
    }
    fetch(dataUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [dataUrl]);

  return { data, loading, error };
}
