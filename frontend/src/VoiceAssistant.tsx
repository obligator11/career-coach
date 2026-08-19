import { useState, useRef } from 'react';

const USER_ID = 'bd104925-3234-4fd7-a183-0528989d798d';
const API_BASE = 'http://127.0.0.1:8000';

interface Turn { role: 'user' | 'assistant'; content: string; }

export default function VoiceAssistant({ onStatusChange }: { onStatusChange: (s: 'idle' | 'thinking' | 'online') => void }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const historyRef = useRef<Turn[]>([]);

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

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser - try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      onStatusChange('thinking');

      try {
        const res = await fetch(
          `${API_BASE}/me/coach-advice?user_id=${USER_ID}&topic=${encodeURIComponent(text)}&history=${encodeURIComponent(JSON.stringify(historyRef.current))}`
        );
        const data = await res.json();
        setReply(data.message);

        historyRef.current.push({ role: 'user', content: text });
        historyRef.current.push({ role: 'assistant', content: data.message });
        if (historyRef.current.length > 10) historyRef.current = historyRef.current.slice(-10);

        await speak(data.message);
      } catch {
        const fallback = "I couldn't reach my thinking module right now.";
        setReply(fallback);
        await speak(fallback);
      } finally {
        onStatusChange('online');
      }
    };

    recognition.start();
  };

  return (
    <div style={{ marginTop: 16, padding: 16, background: '#16162a', borderRadius: 8, color: '#fff', fontFamily: 'sans-serif' }}>
      <button
        onClick={startListening}
        disabled={listening}
        style={{
          padding: '10px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: listening ? '#fbbf24' : '#c084fc', color: '#1a1a2e', fontWeight: 'bold',
        }}
      >
        {listening ? 'Listening...' : 'Talk to your coach'}
      </button>
      {transcript && <p style={{ marginTop: 10, color: '#aaa' }}>You said: "{transcript}"</p>}
      {reply && <p style={{ marginTop: 6 }}>Coach: {reply}</p>}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}