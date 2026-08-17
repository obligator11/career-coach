import { useEffect, useRef, useState } from 'react';

interface OfficeProps {
  onZoneClick: (zone: 'whiteboard' | 'bookshelf' | 'desk') => void;
  onSleepToggle: () => void;
  bubbleText: string | null;
  status: 'idle' | 'thinking' | 'online' | 'asleep';
}

const ROOMS = {
  whiteboard: { x: 30, y: 20, w: 280, h: 170, label: 'Roadmap' },
  bookshelf: { x: 330, y: 20, w: 280, h: 170, label: 'Skills' },
  desk: { x: 30, y: 210, w: 280, h: 170, label: 'Activity' },
  bedroom: { x: 330, y: 210, w: 280, h: 170, label: 'Rest' },
};

const CENTER = {
  whiteboard: { x: 170, y: 110 },
  bookshelf: { x: 470, y: 110 },
  desk: { x: 170, y: 300 },
  bedroom: { x: 470, y: 300 },
};

const WALK_FRAMES = [
  '/assets/character/character_robot_walk0.png',
  '/assets/character/character_robot_walk1.png',
  '/assets/character/character_robot_walk2.png',
  '/assets/character/character_robot_walk3.png',
];

export default function Office({ onZoneClick, onSleepToggle, bubbleText, status }: OfficeProps) {
  const [pos, setPos] = useState(CENTER.desk);
  const [walking, setWalking] = useState(false);
  const [frame, setFrame] = useState(0);
  const walkAnim = useRef<number | null>(null);

  // Cycle walk frames while moving
  useEffect(() => {
    if (walking) {
      walkAnim.current = window.setInterval(() => setFrame((f) => (f + 1) % WALK_FRAMES.length), 150);
    } else if (walkAnim.current) {
      clearInterval(walkAnim.current);
    }
    return () => { if (walkAnim.current) clearInterval(walkAnim.current); };
  }, [walking]);

  const moveTo = (target: { x: number; y: number }) => {
    setWalking(true);
    setPos(target);
    window.setTimeout(() => setWalking(false), 700);
  };

  const handleZoneClick = (zone: 'whiteboard' | 'bookshelf' | 'desk') => {
    moveTo(CENTER[zone]);
    onZoneClick(zone);
  };

  const handleBedClick = () => {
    moveTo(CENTER.bedroom);
    onSleepToggle();
  };

  const spriteSrc = walking
    ? WALK_FRAMES[frame]
    : status === 'thinking'
    ? '/assets/character/character_robot_think.png'
    : status === 'asleep'
    ? '/assets/character/character_robot_down.png'
    : bubbleText
    ? '/assets/character/character_robot_talk.png'
    : '/assets/character/character_robot_idle.png';

  return (
    <svg viewBox="0 0 640 400" style={{ width: '100%', maxWidth: 700, display: 'block', imageRendering: 'pixelated' }}>
      <rect x="0" y="0" width="640" height="400" fill="#0f0f1a" />

      {/* Room boxes */}
      {Object.entries(ROOMS).map(([key, r]) => (
        <rect key={key} x={r.x} y={r.y} width={r.w} height={r.h} rx="6" fill="#1a1a2e" stroke="#333" />
      ))}

      {/* Whiteboard room */}
      <g onClick={() => handleZoneClick('whiteboard')} style={{ cursor: 'pointer' }}>
        <rect x={60} y={40} width={120} height={80} fill="#fff" stroke="#888" strokeWidth="3" />
        <line x1={70} y1={60} x2={160} y2={60} stroke="#5b8def" strokeWidth="2" />
        <line x1={70} y1={75} x2={140} y2={75} stroke="#5b8def" strokeWidth="2" />
        <line x1={70} y1={90} x2={150} y2={90} stroke="#5b8def" strokeWidth="2" />
        <text x={120} y={165} textAnchor="middle" fill="#888" fontSize="11">Roadmap</text>
      </g>

      {/* Bookshelf room */}
      <g onClick={() => handleZoneClick('bookshelf')} style={{ cursor: 'pointer' }}>
        <image href="/assets/furniture/bookcaseClosed.png" x={360} y={35} width={70} height={70} />
        <image href="/assets/furniture/pottedPlant.png" x={540} y={55} width={45} height={45} />
        <text x={470} y={165} textAnchor="middle" fill="#888" fontSize="11">Skills</text>
      </g>

      {/* Desk room */}
      <g onClick={() => handleZoneClick('desk')} style={{ cursor: 'pointer' }}>
        <image href="/assets/furniture/desk.png" x={60} y={260} width={80} height={60} />
        <image href="/assets/furniture/computerScreen.png" x={75} y={235} width={35} height={35} />
        <image href="/assets/furniture/chairDesk.png" x={150} y={255} width={45} height={55} />
        <image href="/assets/furniture/lampRoundFloor.png" x={220} y={240} width={30} height={70} />
        <text x={170} y={365} textAnchor="middle" fill="#888" fontSize="11">Activity</text>
      </g>

      {/* Bedroom */}
      <g onClick={handleBedClick} style={{ cursor: 'pointer' }}>
        <image href="/assets/furniture/bedSingle.png" x={400} y={245} width={110} height={70} />
        <image href="/assets/furniture/rugRectangle.png" x={415} y={330} width={80} height={30} />
        <text x={470} y={365} textAnchor="middle" fill="#888" fontSize="11">
          {status === 'asleep' ? 'Sleeping - click to wake' : 'Click to sleep'}
        </text>
      </g>

      {/* Robot character */}
      <image
        href={spriteSrc}
        x={pos.x - 22}
        y={pos.y - 30}
        width={44}
        height={60}
        style={{ transition: 'x 0.6s, y 0.6s' }}
      />

      {/* Status badge */}
      <circle cx="615" cy="15" r="5" fill={
        status === 'online' ? '#4ade80' : status === 'thinking' ? '#fbbf24' : status === 'asleep' ? '#666' : '#888'
      } />
      <text x="600" y="19" textAnchor="end" fill="#aaa" fontSize="10">{status}</text>

      {/* Speech bubble */}
      {bubbleText && status !== 'asleep' && (
        <g>
          <rect x={pos.x - 100} y={pos.y - 75} width="200" height="40" rx="8" fill="#fbbf24" />
          <text x={pos.x} y={pos.y - 52} textAnchor="middle" fontSize="11" fill="#1a1a2e">
            {bubbleText.length > 45 ? bubbleText.slice(0, 45) + '...' : bubbleText}
          </text>
        </g>
      )}
    </svg>
  );
}