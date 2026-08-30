import { useMemo } from 'react';

type NodeKey = 'memory' | 'skills' | 'roadmap' | 'settings';

interface AICoreProps {
  status: 'idle' | 'thinking' | 'online' | 'asleep';
  onNodeClick: (node: NodeKey) => void;
}

const BUTTON_HEIGHT = 36;
const BUTTON_GAP = 10;

const BASE_NODES: { key: NodeKey; label: string; color: string }[] = [
  { key: 'memory', label: 'MEMORY', color: '#5b8def' },
  { key: 'skills', label: 'SKILLS', color: '#e0a83d' },
  { key: 'roadmap', label: 'ROADMAP', color: '#4ade80' },
  { key: 'settings', label: 'SETTINGS', color: '#c084fc' },
];

const NODES = BASE_NODES.map((n, i) => ({
  ...n,
  y: i * (BUTTON_HEIGHT + BUTTON_GAP) + BUTTON_HEIGHT / 2,
}));

export default function AICore({ status, onNodeClick }: AICoreProps) {
  const particles = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 70;
      pts.push({
        x: 100 + Math.cos(angle) * radius,
        y: 100 + Math.sin(angle) * radius,
        r: Math.random() * 1.4 + 0.4,
        delay: Math.random() * 3,
      });
    }
    return pts;
  }, []);

  const pulseColor = status === 'thinking' ? '#fbbf24' : status === 'online' ? '#c084fc' : '#4a4066';
  const midY = (NODES.length * (BUTTON_HEIGHT + BUTTON_GAP)) / 2;

  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        background: '#12121c',
        border: '1px solid #2a2a40',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: BUTTON_GAP, minWidth: 130 }}>
        {NODES.map((node) => (
          <button
            key={node.key}
            onClick={() => onNodeClick(node.key)}
            style={{
              background: '#1a1a2e',
              border: `1px solid ${node.color}55`,
              borderRadius: 6,
              padding: '8px 12px',
              color: node.color,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: `0 0 8px ${node.color}22`,
              height: BUTTON_HEIGHT,
              boxSizing: 'border-box',
            }}
          >
            {node.label}
          </button>
        ))}
      </div>

      <svg width="100" height={NODES.length * (BUTTON_HEIGHT + BUTTON_GAP)} style={{ flexShrink: 0 }}>
        {NODES.map((node) => {
          const path = `M 4 ${node.y} L 30 ${node.y} C 60 ${node.y}, 60 ${midY}, 100 ${midY}`;
          return (
            <g key={node.key}>
              <path d={path} fill="none" stroke={node.color} strokeWidth="3" opacity="0.7" strokeLinecap="round" />
              <circle r="3.5" fill={node.color}>
                <animateMotion dur="2.5s" repeatCount="indefinite" path={path} />
              </circle>
            </g>
          );
        })}
      </svg>

      <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
        <svg width="200" height="200" viewBox="0 0 200 200">
          <defs>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={pulseColor} stopOpacity="0.35" />
              <stop offset="70%" stopColor={pulseColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={pulseColor} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#coreGlow)" />
          <circle cx="100" cy="100" r="72" fill="none" stroke={pulseColor} strokeWidth="1" opacity="0.3" />
          {particles.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={pulseColor} opacity="0.7">
              <animate
                attributeName="opacity"
                values="0.2;0.9;0.2"
                dur={`${2.5 + p.delay}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </svg>
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 9,
            letterSpacing: 2,
            color: pulseColor,
            fontWeight: 700,
          }}
        >
          {status === 'thinking' ? 'THINKING' : status === 'online' ? 'ONLINE' : status === 'asleep' ? 'RESTING' : 'IDLE'}
        </div>
      </div>
    </div>
  );
}
