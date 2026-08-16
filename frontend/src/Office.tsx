import { motion } from 'framer-motion';
import { useState } from 'react';

interface OfficeProps {
  skills: { skill: string; score: number }[];
  roadmap: { title: string; description: string; target_skill: string }[];
  onZoneClick: (zone: 'whiteboard' | 'bookshelf' | 'desk') => void;
  bubbleText: string | null;
}

const ZONES = {
  whiteboard: { x: 110, y: 75, label: 'Roadmap', color: '#5b8def' },
  bookshelf: { x: 530, y: 200, label: 'Skills', color: '#3fae7f' },
  desk: { x: 320, y: 205, label: 'Activity', color: '#e07a5f' },
};

export default function Office({ onZoneClick, bubbleText }: OfficeProps) {
  const [avatarPos, setAvatarPos] = useState({ x: 320, y: 320 });

  const handleZoneClick = (zone: keyof typeof ZONES) => {
    setAvatarPos({ x: ZONES[zone].x, y: ZONES[zone].y + 30 });
    onZoneClick(zone as 'whiteboard' | 'bookshelf' | 'desk');
  };

  return (
    <svg viewBox="0 0 640 400" style={{ width: '100%', maxWidth: 700, display: 'block' }}>
      <rect x="10" y="10" width="620" height="380" rx="8" fill="#1a1a2e" stroke="#333" />

      <rect
        x="30" y="30" width="160" height="90" rx="6"
        fill={ZONES.whiteboard.color} fillOpacity={0.3}
        style={{ cursor: 'pointer' }}
        onClick={() => handleZoneClick('whiteboard')}
      />
      <text x="110" y="80" textAnchor="middle" fill="#fff" fontSize="13">Roadmap</text>

      <rect
        x="450" y="30" width="160" height="340" rx="6"
        fill={ZONES.bookshelf.color} fillOpacity={0.3}
        style={{ cursor: 'pointer' }}
        onClick={() => handleZoneClick('bookshelf')}
      />
      <text x="530" y="205" textAnchor="middle" fill="#fff" fontSize="13">Skills</text>

      <rect
        x="230" y="150" width="180" height="110" rx="6"
        fill={ZONES.desk.color} fillOpacity={0.3}
        style={{ cursor: 'pointer' }}
        onClick={() => handleZoneClick('desk')}
      />
      <text x="320" y="210" textAnchor="middle" fill="#fff" fontSize="13">Activity</text>

      <motion.circle
        r="14"
        fill="#c084fc"
        animate={{ cx: avatarPos.x, cy: avatarPos.y }}
        transition={{ type: 'tween', duration: 0.5 }}
      />

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