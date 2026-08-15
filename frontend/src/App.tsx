import { useEffect, useState } from 'react';

const USER_ID = 'bd104925-3234-4fd7-a183-0528989d798d';
const API_BASE = 'http://127.0.0.1:8000';

interface Skill {
  skill: string;
  score: number;
}

interface Summary {
  skills: Skill[];
  roadmap: { title: string; description: string; target_skill: string; status: string }[];
  repos: { name: string; last_synced_at: string | null }[];
}

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/me/summary?user_id=${USER_ID}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;
  if (!summary) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>Career Coach - Raw Data Check</h1>
      <h2>Skills ({summary.skills.length})</h2>
      <ul>
        {summary.skills.map((s) => (
          <li key={s.skill}>{s.skill}: {s.score}</li>
        ))}
      </ul>
      <h2>Roadmap ({summary.roadmap.length})</h2>
      <ul>
        {summary.roadmap.map((r) => (
          <li key={r.title}>{r.title} → {r.target_skill}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;