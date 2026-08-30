import { useState } from 'react';

export default function VoiceAssistant({
  onStatusChange,
  onMessage,
}: {
  onStatusChange: (s: 'idle' | 'thinking' | 'online') => void;
  onMessage: (text: string) => Promise<string>;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');

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

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
      if (event.error === 'no-speech') {
        setTranscript('(No speech detected - check your microphone and try again)');
      } else if (event.error === 'not-allowed') {
        setTranscript('(Microphone access denied - check browser permissions)');
      } else {
        setTranscript(`(Voice error: ${event.error})`);
      }
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      // onMessage handles the full flow (thinking status, fetch, and speaking the reply)
      const replyText = await onMessage(text);
      setReply(replyText);
    };

    recognition.start();
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        background: '#16162a',
        border: '1px solid #2a2a40',
        borderRadius: 8,
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <button
        onClick={startListening}
        disabled={listening}
        style={{
          padding: '10px 20px',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: listening ? '#fbbf24' : '#c084fc',
          color: '#1a1a2e',
          fontWeight: 'bold',
        }}
      >
        {listening ? 'Listening...' : 'Talk to your coach'}
      </button>
      {transcript && <p style={{ marginTop: 10, color: '#aaa' }}>You said: "{transcript}"</p>}
      {reply && <p style={{ marginTop: 6 }}>Coach: {reply}</p>}
    </div>
  );
}
