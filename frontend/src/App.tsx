import { useEffect, useRef, useState } from 'react';
import Office, { type ZoneKey } from './Office';
import VoiceAssistant from './VoiceAssistant';
import AICore from './AICore';

const USER_ID = 'bd104925-3234-4fd7-a183-0528989d798d';
const API_BASE = 'http://127.0.0.1:8000';
const TOPICS_KEY = 'coach_recent_topics';

interface Skill { skill: string; score: number; }
interface RoadmapItem { title: string; description: string; target_skill: string; status: string; }
interface Summary {
  skills: Skill[];
  roadmap: RoadmapItem[];
  repos: { name: string; last_synced_at: string | null }[];
}
interface Topic { text: string; time: string; }

type Status = 'idle' | 'thinking' | 'online' | 'asleep';

function decideZone(text: string): ZoneKey {
  const t = text.toLowerCase();
  if (/skill|python|language|score|strong|good at/.test(t)) return 'bookshelf';
  if (/roadmap|project|next|build|idea|suggest/.test(t)) return 'whiteboard';
  if (/sleep|rest|bed|off|quiet/.test(t)) return 'bedroom';
  return 'desk';
}

function loadTopics(): Topic[] {
  try {
    const raw = localStorage.getItem(TOPICS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function TagInput({
  placeholder,
  values,
  onChange,
}: {
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const cleaned = draft.trim();
    if (cleaned && !values.includes(cleaned)) {
      onChange([...values, cleaned]);
    }
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(values.filter((v) => v !== tag));
  };

  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8,
        borderRadius: 6, border: '1px solid #2a2a40', background: '#16162a', minHeight: 20,
      }}
    >
      {values.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            borderRadius: 14, background: '#2a2350', color: '#c084fc', fontSize: 12,
          }}
        >
          {tag}
          <span onClick={() => removeTag(tag)} style={{ cursor: 'pointer', fontWeight: 700, color: '#888' }}>×</span>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) {
            setDraft(e.target.value.slice(0, -1));
            commitDraft();
          } else {
            setDraft(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitDraft();
          } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
            removeTag(values[values.length - 1]);
          }
        }}
        placeholder={values.length === 0 ? placeholder : ''}
        style={{
          flex: 1, minWidth: 100, background: 'transparent', border: 'none',
          color: '#fff', outline: 'none', fontSize: 13,
        }}
      />
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<'local' | 'gemini' | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [requestedZone, setRequestedZone] = useState<ZoneKey | null>(null);
  const [topics, setTopics] = useState<Topic[]>(loadTopics());
  const ambientTimer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [prefsChecked, setPrefsChecked] = useState(false);
  const [prefsExist, setPrefsExist] = useState(true);
  const [prefsForm, setPrefsForm] = useState({
    degree_field: '',
    target_roles: [] as string[],
    preferred_locations: [] as string[],
    remote_preference: 'remote',
    experience_level: 'junior',
  });

  useEffect(() => {
    fetch(`${API_BASE}/me/summary?user_id=${USER_ID}`)
      .then((res) => { if (!res.ok) throw new Error(`Status ${res.status}`); return res.json(); })
      .then((data) => { setSummary(data); setStatus('online'); })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!mode) return;
    fetch(`${API_BASE}/me/preferences?user_id=${USER_ID}`)
      .then((res) => res.json())
      .then((data) => {
        setPrefsExist(data.exists);
        setPrefsChecked(true);
      })
      .catch(() => setPrefsChecked(true));
  }, [mode]);

  useEffect(() => {
    if (!summary || status === 'asleep') return;
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
  }, [summary, status]);

  const speak = async (text: string) => {
    try {
      const res = await fetch(`${API_BASE}/me/coach-voice?text=${encodeURIComponent(text)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } catch {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const logTopic = (text: string) => {
    setTopics((prev) => {
      const next = [{ text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 8);
      localStorage.setItem(TOPICS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const askCoach = async (topic: string): Promise<string> => {
    if (ambientTimer.current) clearTimeout(ambientTimer.current);
    const zone = decideZone(topic);
    setRequestedZone(zone);
    setStatus('thinking');
    setBubbleText('Thinking...');
    let reply = 'Keep going - every commit counts.';
    try {
      const res = await fetch(`${API_BASE}/me/coach-advice?user_id=${USER_ID}&topic=${encodeURIComponent(topic)}&mode=${mode}`);
      const data = await res.json();
      reply = data.message;
      setBubbleText(reply);
    } catch {
      setBubbleText(reply);
    }
    logTopic(topic);
    await speak(reply);
    setStatus('online');
    return reply;
  };

  const handleZoneClick = async (zone: 'whiteboard' | 'bookshelf' | 'desk') => {
    if (!summary || status === 'asleep') return;
    setRequestedZone(zone);
    if (zone === 'whiteboard') {
      const text = `${summary.roadmap.length} project ideas waiting for you`;
      setBubbleText(text);
      logTopic('roadmap');
      await speak(text);
    } else if (zone === 'bookshelf') {
      const top = summary.skills[0];
      const text = `Your strongest skill: ${top?.skill} (${top?.score})`;
      setBubbleText(text);
      logTopic('skills');
      await speak(text);
    } else if (zone === 'desk') {
      await askCoach('recent activity');
    }
  };

  const handleSleepToggle = () => {
    const goingToSleep = status !== 'asleep';
    setStatus(goingToSleep ? 'asleep' : 'online');
    setRequestedZone(goingToSleep ? 'bedroom' : 'desk');
    setBubbleText(null);
  };

  const handleCoreNodeClick = (node: 'memory' | 'skills' | 'roadmap' | 'settings') => {
    if (node === 'skills') handleZoneClick('bookshelf');
    else if (node === 'roadmap') handleZoneClick('whiteboard');
    else if (node === 'memory') askCoach('what have we talked about recently');
  };

  const savePreferences = async () => {
    const params = new URLSearchParams({
      user_id: USER_ID,
      degree_field: prefsForm.degree_field,
      target_roles: prefsForm.target_roles.join(','),
      preferred_locations: prefsForm.preferred_locations.join(','),
      remote_preference: prefsForm.remote_preference,
      experience_level: prefsForm.experience_level,
    });
    await fetch(`${API_BASE}/me/preferences?${params.toString()}`, { method: 'POST' });
    setPrefsExist(true);
  };

  if (!mode) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          background: 'radial-gradient(circle at 50% 0%, #1a1030 0%, #0a0a12 60%)',
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        <h1 style={{ color: '#fff', fontSize: 24, letterSpacing: 1 }}>
          CAREER COACH <span style={{ color: '#c084fc' }}>AI</span>
        </h1>
        <p style={{ color: '#aaa', fontSize: 14, marginBottom: 10 }}>How should Nova think today?</p>
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => setMode('local')}
            style={{
              padding: '16px 28px', borderRadius: 10, border: '1px solid #4a4066',
              background: '#16162a', color: '#c084fc', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Local (Ollama)<br />
            <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>Offline, private, slower</span>
          </button>
          <button
            onClick={() => setMode('gemini')}
            style={{
              padding: '16px 28px', borderRadius: 10, border: '1px solid #4a4066',
              background: '#16162a', color: '#5b8def', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Gemini (Cloud)<br />
            <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>Fast, needs internet</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode && prefsChecked && !prefsExist) {
    return (
      <div
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16, background: 'radial-gradient(circle at 50% 0%, #1a1030 0%, #0a0a12 60%)',
          fontFamily: "'Segoe UI', sans-serif", padding: 24,
        }}
      >
        <h1 style={{ color: '#fff', fontSize: 22 }}>Tell Nova about yourself</h1>
        <p style={{ color: '#aaa', fontSize: 13, marginBottom: 10 }}>
          This is asked once - Nova will use it to find relevant jobs later.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 340 }}>
          <input
            placeholder="Degree / field (e.g. Computer Science)"
            value={prefsForm.degree_field}
            onChange={(e) => setPrefsForm({ ...prefsForm, degree_field: e.target.value })}
            style={{ padding: 10, borderRadius: 6, border: '1px solid #2a2a40', background: '#16162a', color: '#fff' }}
          />
          <TagInput
            placeholder="Target roles - type and press Enter or comma"
            values={prefsForm.target_roles}
            onChange={(vals) => setPrefsForm({ ...prefsForm, target_roles: vals })}
          />
          <TagInput
            placeholder="Preferred locations - type and press Enter or comma"
            values={prefsForm.preferred_locations}
            onChange={(vals) => setPrefsForm({ ...prefsForm, preferred_locations: vals })}
          />
          <select
            value={prefsForm.remote_preference}
            onChange={(e) => setPrefsForm({ ...prefsForm, remote_preference: e.target.value })}
            style={{ padding: 10, borderRadius: 6, border: '1px solid #2a2a40', background: '#16162a', color: '#fff' }}
          >
            <option value="remote">Remote</option>
            <option value="onsite">Onsite</option>
            <option value="hybrid">Hybrid</option>
            <option value="any">No preference</option>
          </select>
          <select
            value={prefsForm.experience_level}
            onChange={(e) => setPrefsForm({ ...prefsForm, experience_level: e.target.value })}
            style={{ padding: 10, borderRadius: 6, border: '1px solid #2a2a40', background: '#16162a', color: '#fff' }}
          >
            <option value="intern">Intern</option>
            <option value="junior">Junior</option>
            <option value="senior">Senior</option>
          </select>
          <button
            onClick={savePreferences}
            style={{
              marginTop: 8, padding: '12px 20px', borderRadius: 8, border: 'none',
              background: '#c084fc', color: '#1a1a2e', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Save and continue
          </button>
        </div>
      </div>
    );
  }

  if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;
  if (!summary) return <div style={{ padding: 20 }}>Loading...</div>;

  const statusColor = status === 'online' ? '#4ade80' : status === 'thinking' ? '#fbbf24' : '#666';

  return (
    <div
      style={{
        padding: 24,
        background: 'radial-gradient(circle at 50% 0%, #1a1030 0%, #0a0a12 60%)',
        minHeight: '100vh',
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          borderBottom: '1px solid #2a2a40',
          paddingBottom: 14,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 10px ${statusColor}`,
          }}
        />
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: 1 }}>
          CAREER COACH <span style={{ color: '#c084fc' }}>AI</span>
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'nowrap', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ flex: '0 1 260px', minWidth: 220 }}>
          <div
            style={{
              background: '#16162a',
              border: '1px solid #2a2a40',
              borderRadius: 8,
              padding: 14,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#888', marginBottom: 10 }}>RECENT TOPICS</div>
            {topics.length === 0 && (
              <div style={{ fontSize: 12, color: '#666' }}>Nothing asked yet - talk or type to get started.</div>
            )}
            {topics.map((t, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  color: '#ccc',
                  padding: '8px 0',
                  borderBottom: i < topics.length - 1 ? '1px solid #22223a' : 'none',
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</div>
                <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{t.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 620px', minWidth: 320 }}>
          <AICore status={status} onNodeClick={handleCoreNodeClick} />
          <Office
            onZoneClick={handleZoneClick}
            onSleepToggle={handleSleepToggle}
            bubbleText={bubbleText}
            status={status}
            requestedZone={requestedZone}
          />
        </div>

        <div style={{ flex: '0 1 340px', minWidth: 280 }}>
          {status !== 'asleep' && <VoiceAssistant onStatusChange={setStatus} onMessage={askCoach} />}

          {status !== 'asleep' && (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                gap: 8,
                background: '#16162a',
                border: '1px solid #2a2a40',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <input
                type="text"
                placeholder="Type instruction or ask your coach..."
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 14 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    const text = e.currentTarget.value;
                    e.currentTarget.value = '';
                    askCoach(text);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}

export default App;
