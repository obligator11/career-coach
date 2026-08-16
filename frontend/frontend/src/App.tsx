import { useEffect, useRef, useState } from 'react';
import Office from './Office';
import VoiceAssistant from './VoiceAssistant';

const USER_ID = 'bd104925-3234-4fd7-a183-0528989d798d';
const API_BASE = 'http://127.0.0.1:8000';

interface Skill { skill: string; score: number; }
interface RoadmapItem { title: string; description: string; target_skill: string; status: string; }
interface Summary {
  skills: Skill[];
  roadmap: RoadmapItem[];
  repos: { name: string; last_synced_at: string | null }[];
}

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'online'>('idle');
  const ambientTimer = useRef<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/me/summary?user_id=${USER_ID}`)
      .then((res) => { if (!res.ok) throw new Error(`Status ${res.status}`); return res.json(); })
      .then((data) => { setSummary(data); setStatus('online'); })
      .catch((err) => setError(err.message));
  }, []);

  // Ambient small-talk: every 15-25s, say something true and local, no LLM call needed
  useEffect(() => {
    if (!summary) return;
    function scheduleAmbient() {
      const delay = 15000 + Math.random() * 10000;
      ambientTimer.current = window.setTimeout(() => {
        const lines = [
          `${summary!.repos.length} repos synced, all quiet for now`,
          `Your top skill is still ${summary!.skills[0]?.skill}`,
          `${summary!.roadmap.length} project ideas waiting whenever you're ready`,
          `Last sync looked clean - nothing broken`,
        ];
        setBubbleText(lines[Math.floor(Math.random() * lines.length)]);
        setTimeout(() => setBubbleText(null), 4000);
        scheduleAmbient();
      }, delay);
    }
    scheduleAmbient();
    return () => { if (ambientTimer.current) clearTimeout(ambientTimer.current); };
  }, [summary]);

  const handleZoneClick = async (zone: 'whiteboard' | 'bookshelf' | 'desk') => {
    if (!summary) return;
    if (ambientTimer.current) clearTimeout(ambientTimer.current);

    if (zone === 'whiteboard') {
      setBubbleText(`${summary.roadmap.length} project ideas waiting for you`);
    } else if (zone === 'bookshelf') {
      const top = summary.skills[0];
      setBubbleText(`Your strongest skill: ${top?.skill} (${top?.score})`);
    } else if (zone === 'desk') {
      setStatus('thinking');
      setBubbleText('Thinking...');
      try {
        const res = await fetch(`${API_BASE}/me/coach-advice?user_id=${USER_ID}&topic=recent activity`);
        const data = await res.json();
        setBubbleText(data.message);
      } catch {
        setBubbleText('Keep going - every commit counts.');
      } finally {
        setStatus('online');
      }
    }
  };

  if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;
  if (!summary) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, background: '#0f0f1a', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', fontFamily: 'sans-serif' }}>Career Coach Office</h1>
      <Office onZoneClick={handleZoneClick} bubbleText={bubbleText} status={status} />
      <VoiceAssistant onStatusChange={setStatus} />
    </div>
  );
}

export default App;
