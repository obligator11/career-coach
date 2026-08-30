import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export type ZoneKey = 'whiteboard' | 'bookshelf' | 'desk' | 'bedroom';

interface OfficeProps {
  onZoneClick: (zone: 'whiteboard' | 'bookshelf' | 'desk') => void;
  onSleepToggle: () => void;
  bubbleText: string | null;
  status: 'idle' | 'thinking' | 'online' | 'asleep';
  requestedZone: ZoneKey | null;
}

const HALLWAY = { x: 280, y: 0, w: 80, h: 420 };

const ROOMS = {
  whiteboard: { x: 0, y: 0, w: 280, h: 200, doorY: 90 },
  bookshelf: { x: 360, y: 0, w: 280, h: 200, doorY: 90 },
  desk: { x: 0, y: 220, w: 280, h: 200, doorY: 310 },
  bedroom: { x: 360, y: 220, w: 280, h: 200, doorY: 310 },
};

const CENTER: Record<ZoneKey, { x: number; y: number }> = {
  whiteboard: { x: 140, y: 110 },
  bookshelf: { x: 500, y: 110 },
  desk: { x: 140, y: 320 },
  bedroom: { x: 500, y: 320 },
};

const DOOR_HALLWAY_POINT: Record<ZoneKey, { x: number; y: number }> = {
  whiteboard: { x: 320, y: 90 },
  bookshelf: { x: 320, y: 90 },
  desk: { x: 320, y: 310 },
  bedroom: { x: 320, y: 310 },
};

const HALLWAY_WANDER_POINTS = [
  { x: 320, y: 60 },
  { x: 320, y: 150 },
  { x: 320, y: 270 },
  { x: 320, y: 360 },
];

const RUN_SHEET = '/assets/character-v2/Amelia_run_16x16.png';
const IDLE_SHEET = '/assets/character-v2/Amelia_idle_16x16.png';
const FRAME_W = 16;
const FRAME_H = 32;
const DOWN_FACING_START_FRAME = 18;
const WALK_FRAME_COUNT = 6;
const IDLE_FRAME_INDEX = 3;
const SCALE = 2.2;

const BED = '/assets/interiors/bed.png';
const BOOKSHELF = '/assets/interiors/bookshelf.png';

const WALL_COLOR = '#5a4530';
const WALL_HIGHLIGHT = '#7a5f42';
const FLOOR_A = '#8a6842';
const FLOOR_B = '#7a5a38';
const HALLWAY_A = '#6b4f30';
const HALLWAY_B = '#5f4528';

const LEG_DURATION = 0.9;

function Rug({ x, y, w, h, color, accent }: { x: number; y: number; w: number; h: number; color: string; accent: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={color} stroke={accent} strokeWidth="3" />
      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} rx="2" fill="none" stroke={accent} strokeWidth="2" opacity="0.6" />
    </g>
  );
}

function Chair({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(1.3)`}>
      <rect x="2" y="6" width="22" height="20" rx="3" fill="#8b6d4f" stroke="#5a4530" strokeWidth="1.5" />
      <rect x="5" y="2" width="16" height="8" rx="2" fill="#a3835f" stroke="#5a4530" strokeWidth="1.5" />
      <rect x="8" y="10" width="10" height="10" rx="2" fill="#5a4530" opacity="0.3" />
    </g>
  );
}

export default function Office({ onZoneClick, onSleepToggle, bubbleText, status, requestedZone }: OfficeProps) {
  const [pos, setPos] = useState(CENTER.bedroom);
  const [walking, setWalking] = useState(false);
  const [frame, setFrame] = useState(0);
  const walkAnim = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const busyRef = useRef(false);
  const currentZone = useRef<ZoneKey>('bedroom');

  useEffect(() => {
    if (walking) {
      walkAnim.current = window.setInterval(() => setFrame((f) => (f + 1) % WALK_FRAME_COUNT), 220);
    } else if (walkAnim.current) {
      clearInterval(walkAnim.current);
    }
    return () => { if (walkAnim.current) clearInterval(walkAnim.current); };
  }, [walking]);

  const walkPath = (points: { x: number; y: number }[], onDone?: () => void) => {
    busyRef.current = true;
    setWalking(true);
    let i = 0;
    const step = () => {
      if (i >= points.length) {
        setWalking(false);
        busyRef.current = false;
        onDone?.();
        return;
      }
      setPos(points[i]);
      i++;
      window.setTimeout(step, LEG_DURATION * 1000);
    };
    step();
  };

  const goToZone = (zone: ZoneKey) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (zone === currentZone.current || busyRef.current) return;

    const fromDoor = DOOR_HALLWAY_POINT[currentZone.current];
    const toDoor = DOOR_HALLWAY_POINT[zone];
    walkPath([fromDoor, toDoor, CENTER[zone]], () => {
      currentZone.current = zone;
    });
  };

  useEffect(() => {
    if (requestedZone && requestedZone !== currentZone.current) {
      goToZone(requestedZone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedZone]);

  const handleZoneClick = (zone: 'whiteboard' | 'bookshelf' | 'desk') => {
    goToZone(zone);
    onZoneClick(zone);
  };

  const handleBedClick = () => {
    goToZone('bedroom');
    onSleepToggle();
  };

  useEffect(() => {
    if (status === 'asleep') return;

    function scheduleWander() {
      const delay = 6000 + Math.random() * 4000;
      idleTimer.current = window.setTimeout(() => {
        if (!busyRef.current) {
          const point = HALLWAY_WANDER_POINTS[Math.floor(Math.random() * HALLWAY_WANDER_POINTS.length)];
          walkPath([point]);
        }
        scheduleWander();
      }, delay);
    }
    scheduleWander();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [status]);

  const statusColor =
    status === 'online' ? '#4ade80' : status === 'thinking' ? '#fbbf24' : status === 'asleep' ? '#666' : '#888';

  const activeFrameIndex = walking ? DOWN_FACING_START_FRAME + frame : IDLE_FRAME_INDEX;
  const activeSheet = walking ? RUN_SHEET : IDLE_SHEET;
  const sheetWidth = walking ? 384 : 64;

  const renderFloor = (x: number, y: number, w: number, h: number, colorA: string, colorB: string) => {
    const tiles = [];
    const size = 20;
    for (let ty = y; ty < y + h; ty += size) {
      for (let tx = x; tx < x + w; tx += size) {
        const shade = (Math.floor(tx / size) + Math.floor(ty / size)) % 2 === 0 ? colorA : colorB;
        tiles.push(<rect key={`${tx}-${ty}`} x={tx} y={ty} width={size} height={size} fill={shade} />);
      }
    }
    return tiles;
  };

  const WALL_T = 8;
  const charW = FRAME_W * SCALE;
  const charH = FRAME_H * SCALE;

  return (
    <div
      style={{
        background: '#12121c',
        border: '1px solid #2a2a40',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 0 30px rgba(192, 132, 252, 0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#888', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>Agent View</span>
        <span style={{ color: statusColor, fontSize: 11 }}>● {status}</span>
      </div>

      <svg viewBox="0 0 640 420" style={{ width: '100%', maxWidth: 700, display: 'block', imageRendering: 'pixelated' }}>
        <defs>
          <clipPath id="charClipInner">
            <rect x="0" y="0" width={FRAME_W} height={FRAME_H} />
          </clipPath>
        </defs>

        <rect x="0" y="0" width="640" height="420" fill="#0a0812" />
        {renderFloor(HALLWAY.x, HALLWAY.y, HALLWAY.w, HALLWAY.h, HALLWAY_A, HALLWAY_B)}
        {Object.values(ROOMS).map((r, i) => (
          <g key={i}>{renderFloor(r.x, r.y, r.w, r.h, FLOOR_A, FLOOR_B)}</g>
        ))}

        <Rug x={25} y={125} w={130} h={60} color="#9b3d3d" accent="#d4a94a" />
        <Rug x={385} y={125} w={130} h={60} color="#3d6b9b" accent="#a4c4e0" />
        <Rug x={25} y={335} w={110} h={55} color="#4a7a4a" accent="#a4d4a4" />
        <Rug x={385} y={335} w={130} h={55} color="#7a5a9b" accent="#c4a4e0" />

        {Object.entries(ROOMS).map(([key, r]) => {
          const isLeft = key === 'whiteboard' || key === 'desk';
          return (
            <g key={key}>
              <rect x={r.x} y={r.y} width={r.w} height={WALL_T} fill={WALL_COLOR} stroke={WALL_HIGHLIGHT} strokeWidth="1" />
              <rect x={r.x} y={r.y + r.h - WALL_T} width={r.w} height={WALL_T} fill={WALL_COLOR} stroke={WALL_HIGHLIGHT} strokeWidth="1" />
              <rect x={isLeft ? r.x : r.x + r.w - WALL_T} y={r.y} width={WALL_T} height={r.h} fill={WALL_COLOR} stroke={WALL_HIGHLIGHT} strokeWidth="1" />
              <rect
                x={isLeft ? r.x + r.w - WALL_T : r.x}
                y={r.y}
                width={WALL_T}
                height={r.doorY - r.y - 25}
                fill={WALL_COLOR}
                stroke={WALL_HIGHLIGHT}
                strokeWidth="1"
              />
              <rect
                x={isLeft ? r.x + r.w - WALL_T : r.x}
                y={r.doorY + 25}
                width={WALL_T}
                height={r.y + r.h - (r.doorY + 25)}
                fill={WALL_COLOR}
                stroke={WALL_HIGHLIGHT}
                strokeWidth="1"
              />
            </g>
          );
        })}

        <g onClick={() => handleZoneClick('whiteboard')} style={{ cursor: 'pointer' }}>
          <rect x={ROOMS.whiteboard.x} y={ROOMS.whiteboard.y} width={ROOMS.whiteboard.w} height={ROOMS.whiteboard.h} fill="transparent" />
          <image href={BOOKSHELF} x={25} y={15} width={85} height={85} />
          <image href={BOOKSHELF} x={120} y={15} width={85} height={85} />
        </g>

        <g onClick={() => handleZoneClick('bookshelf')} style={{ cursor: 'pointer' }}>
          <rect x={ROOMS.bookshelf.x} y={ROOMS.bookshelf.y} width={ROOMS.bookshelf.w} height={ROOMS.bookshelf.h} fill="transparent" />
          <image href={BOOKSHELF} x={385} y={15} width={85} height={85} />
          <image href="/assets/furniture/pottedPlant.png" x={490} y={30} width={75} height={75} />
        </g>

        <g onClick={() => handleZoneClick('desk')} style={{ cursor: 'pointer' }}>
          <rect x={ROOMS.desk.x} y={ROOMS.desk.y} width={ROOMS.desk.w} height={ROOMS.desk.h} fill="transparent" />
          <image href="/assets/furniture/desk.png" x={25} y={245} width={130} height={96} />
          <image href="/assets/furniture/computerScreen.png" x={50} y={205} width={58} height={58} />
          <Chair x={150} y={260} />
          <image href="/assets/furniture/lampRoundFloor.png" x={225} y={220} width={50} height={110} />
        </g>

        <g onClick={handleBedClick} style={{ cursor: 'pointer' }}>
          <rect x={ROOMS.bedroom.x} y={ROOMS.bedroom.y} width={ROOMS.bedroom.w} height={ROOMS.bedroom.h} fill="transparent" />
          <image href={BED} x={435} y={225} width={85} height={112} />
        </g>

        <motion.svg
          width={charW}
          height={charH}
          viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
          animate={{ x: pos.x - charW / 2, y: pos.y - charH + 8 }}
          transition={{ duration: LEG_DURATION, ease: 'easeInOut' }}
        >
          <image
            href={activeSheet}
            x={-activeFrameIndex * FRAME_W}
            y="0"
            width={sheetWidth}
            height={FRAME_H}
            clipPath="url(#charClipInner)"
          />
        </motion.svg>

        {bubbleText && status !== 'asleep' && (
          <g>
            <rect x={pos.x - 100} y={pos.y - charH - 24} width="200" height="40" rx="8" fill="#fbbf24" />
            <text x={pos.x} y={pos.y - charH - 1} textAnchor="middle" fontSize="11" fill="#1a1a2e">
              {bubbleText.length > 45 ? bubbleText.slice(0, 45) + '...' : bubbleText}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
