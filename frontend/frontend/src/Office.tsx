import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface OfficeProps {
  onZoneClick: (zone: 'whiteboard' | 'bookshelf' | 'desk') => void;
  bubbleText: string | null;
  status: 'idle' | 'thinking' | 'online';
}

const ZONES = {
  whiteboard: { x: 110, y: 105, color: '#5b8def' },
  bookshelf: { x: 530, y: 230, color: '#3fae7f' },
  desk: { x: 320, y: 235, color: '#e07a5f' },
  rest: { x: 320, y: 330, color: '#666' },
};

type ZoneKey = keyof typeof ZONES;

export default function Office({ onZoneClick, bubbleText, status }: OfficeProps) {
  const [avatarPos, setAvatarPos] = useState({ x: 320, y: 330 });
  const idleTimer = useRef<number | null>(null);

  // Idle wandering: every 6-10s, if nothing's happening, drift to a random zone
  useEffect(() => {
    function scheduleWander() {
      const delay = 6000 + Math.random() * 4000;
      idleTimer.current = window.setTimeout(() => {
        const keys: ZoneKey[] = ['whiteboard', 'bookshelf', 'desk', 'rest'];
        const next = keys[Math.floor(Math.random() * keys.length)];
        setAvatarPos({ x: ZONES[next].x, y: ZONES[next].y + 30 });
        scheduleWander();
      }, delay);
    }
    scheduleWander();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, []);

  const handleZoneClick = (zone: 'whiteboard' | 'bookshelf' | 'desk') => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setAvatarPos({ x: ZONES[zone].x, y: ZONES[zone].y + 30 });
    onZoneClick(zone);
  };

  const statusColor = status === 'online' ? '#4ade80' : status === 'thinking' ? '#fbbf24' : '#888';

  return (
    <svg viewBox="0 0 640 400" style={{ width: '100%', maxWidth: 700, display: 'block' }}>
      <rect x="10" y="10" width="620" height="380" rx="8" fill="#1a1a2e" stroke="#333" />

      <rect x="30" y="30" width="160" height="90" rx="6" fill={ZONES.whiteboard.color} fillOpacity={0.25}
        style={{ cursor: 'pointer' }} onClick={() => handleZoneClick('whiteboard')} />
      <text x="110" y="80" textAnchor="middle" fill="#fff" fontSize="13">Roadmap</text>

      <rect x="450" y="30" width="160" height="340" rx="6" fill={ZONES.bookshelf.color} fillOpacity={0.25}
        style={{ cursor: 'pointer' }} onClick={() => handleZoneClick('bookshelf')} />
      <text x="530" y="205" textAnchor="middle" fill="#fff" fontSize="13">Skills</text>

      <rect x="230" y="150" width="180" height="110" rx="6" fill={ZONES.desk.color} fillOpacity={0.25}
        style={{ cursor: 'pointer' }} onClick={() => handleZoneClick('desk')} />
      <text x="320" y="210" textAnchor="middle" fill="#fff" fontSize="13">Activity</text>

      <motion.circle r="14" fill="#c084fc"
        animate={{ cx: avatarPos.x, cy: avatarPos.y }}
        transition={{ type: 'tween', duration: 1.4, ease: 'easeInOut' }} />

      {/* Status badge - top right, always visible, reflects real backend state */}
      <circle cx="605" cy="25" r="5" fill={statusColor} />
      <text x="590" y="29" textAnchor="end" fill="#aaa" fontSize="10">{status}</text>

      {bubbleText && (
        <g>
          <rect x="150" y="330" width="340" height="50" rx="10" fill="#fbbf24" />
          <text x="320" y="360" textAnchor="middle" fontSize="12" fill="#1a1a2e">
            {bubbleText.length > 60 ? bubbleText.slice(0, 60) + '...' : bubbleText}
          </text>
        </g>
      )}
    </svg>
  );
}