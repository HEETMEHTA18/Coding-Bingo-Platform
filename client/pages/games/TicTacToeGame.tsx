import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import GameHeader from "../../components/GameHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Team, Room, GameStateResponse } from "@shared/api";
import { Editor } from "@monaco-editor/react";
import { executeCode } from "../../lib/codeExecutor";
import {
  Trophy,
  Sword,
  Zap,
  HelpCircle,
  X,
  Circle,
  Scissors,
  AlertCircle,
  Users,
  Swords,
} from "lucide-react";


function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Battle VS Animation ─────────────────────────────────────────────────────
interface BattleAnimProps {
  teamName: string;
  opponentName: string;
  onDone: () => void;
}

// Pre-generate deterministic particle data to avoid random values inside JSX
const SPARK_DATA = Array.from({ length: 60 }, (_, i) => ({
  angle: (i / 60) * 360,
  speed: 80 + (i % 7) * 30,
  size: 2 + (i % 4),
  color: i % 3 === 0 ? '#facc15' : i % 3 === 1 ? '#3b82f6' : '#ef4444',
  delay: (i % 5) * 0.06,
  duration: 0.6 + (i % 4) * 0.2,
}));

const DEBRIS_DATA = Array.from({ length: 24 }, (_, i) => ({
  x: -40 + (i % 9) * 10,
  y: -40 + Math.floor(i / 9) * 20,
  rotate: i * 15,
  size: 3 + (i % 4) * 2,
  delay: (i % 6) * 0.04,
}));

const RING_DATA = [
  { delay: 0,    color: 'rgba(168,85,247,0.9)', dur: 0.9 },
  { delay: 0.12, color: 'rgba(250,204,21,0.7)', dur: 1.1 },
  { delay: 0.25, color: 'rgba(239,68,68,0.5)',  dur: 1.3 },
  { delay: 0.38, color: 'rgba(59,130,246,0.4)', dur: 1.5 },
];

type BattlePhase = 'hidden' | 'slideIn' | 'countdown3' | 'countdown2' | 'countdown1' | 'clash' | 'reveal' | 'exit';

function BattleAnimation({ teamName, opponentName, onDone }: BattleAnimProps) {
  const [phase, setPhase] = useState<BattlePhase>('hidden');
  const [shake, setShake] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [showSparks, setShowSparks] = useState(false);
  const [showBeam, setShowBeam] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const add = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    add(() => setPhase('slideIn'), 50);
    add(() => { setPhase('countdown3'); setCountdownNum(3); }, 900);
    add(() => { setPhase('countdown2'); setCountdownNum(2); }, 1700);
    add(() => { setPhase('countdown1'); setCountdownNum(1); }, 2500);
    add(() => {
      setCountdownNum(null);
      setPhase('clash');
      setShowBeam(true);
    }, 3300);
    add(() => {
      setShowFlash(true);
      setShowSparks(true);
      setShake(true);
      setGlitch(true);
    }, 3350);
    add(() => { setShowFlash(false); }, 3500);
    add(() => { setShake(false); }, 3700);
    add(() => { setGlitch(false); setShowBeam(false); }, 3900);
    add(() => { setPhase('reveal'); }, 4100);
    add(() => { setPhase('exit'); }, 5200);
    add(() => onDone(), 5800);

    return () => timers.forEach(clearTimeout);
  }, []);

  const slideInX = phase === 'hidden' || phase === 'exit';
  const isClashOrLater = ['clash', 'reveal'].includes(phase);
  const isReveal = phase === 'reveal';
  const isExit = phase === 'exit';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: isReveal
          ? 'radial-gradient(ellipse at 50% 50%, #1a0030 0%, #000000 60%)'
          : 'radial-gradient(ellipse at 50% 50%, #0a0010 0%, #000000 80%)',
        animation: shake ? 'screenShake 0.35s cubic-bezier(.36,.07,.19,.97)' : 'none',
      }}
    >
      {/* ── Animated grid backdrop ── */}
      <div className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(168,85,247,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          animation: 'gridPulse 2s ease-in-out infinite',
        }} />

      {/* ── CRT scan lines ── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 6px)' }} />

      {/* ── Vignette ── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />

      {/* ── White flash on impact ── */}
      {showFlash && (
        <div className="absolute inset-0 z-50 pointer-events-none"
          style={{ background: 'white', animation: 'flashOut 0.35s ease-out forwards' }} />
      )}

      {/* ── Shockwave rings ── */}
      {showSparks && RING_DATA.map((r, i) => (
        <div key={i} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 40 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            border: `4px solid ${r.color}`,
            animationDelay: `${r.delay}s`,
            animation: `shockRing ${r.dur}s ease-out ${r.delay}s forwards`,
            boxShadow: `0 0 20px ${r.color}`,
          }} />
        </div>
      ))}

      {/* ── Energy beam clash ── */}
      {showBeam && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 38 }}>
          {/* Left beam (blue) */}
          <div style={{
            position: 'absolute',
            width: '50%', height: 6,
            right: '50%',
            background: 'linear-gradient(to right, transparent, #3b82f6, #a855f7)',
            boxShadow: '0 0 30px #3b82f6, 0 0 60px rgba(59,130,246,0.5)',
            animation: 'beamLeft 1.2s ease-out forwards',
            borderRadius: 3,
          }} />
          {/* Right beam (red) */}
          <div style={{
            position: 'absolute',
            width: '50%', height: 6,
            left: '50%',
            background: 'linear-gradient(to left, transparent, #ef4444, #a855f7)',
            boxShadow: '0 0 30px #ef4444, 0 0 60px rgba(239,68,68,0.5)',
            animation: 'beamRight 1.2s ease-out forwards',
            borderRadius: 3,
          }} />
          {/* Clash core */}
          <div style={{
            position: 'absolute',
            width: 32, height: 32,
            borderRadius: '50%',
            background: 'radial-gradient(circle, white 0%, #facc15 30%, #a855f7 60%, transparent 100%)',
            boxShadow: '0 0 60px #facc15, 0 0 120px #a855f7',
            animation: 'clashCore 1.2s ease-out forwards',
          }} />
        </div>
      )}

      {/* ── Spark particles ── */}
      {showSparks && SPARK_DATA.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * s.speed;
        const ty = Math.sin(rad) * s.speed;
        return (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: s.size, height: s.size,
            borderRadius: '50%',
            background: s.color,
            boxShadow: `0 0 6px ${s.color}`,
            zIndex: 45,
            animation: `sparkFly 0.7s ease-out ${s.delay}s both`,
            '--tx': `${tx}px`,
            '--ty': `${ty}px`,
          } as any} />
        );
      })}

      {/* ── Debris shards ── */}
      {showSparks && DEBRIS_DATA.map((d, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: d.size, height: d.size * 0.4,
          background: i % 2 === 0 ? 'rgba(59,130,246,0.8)' : 'rgba(239,68,68,0.8)',
          transform: `rotate(${d.rotate}deg)`,
          zIndex: 44,
          animation: `debrisFly 1.1s ease-out ${d.delay}s both`,
          '--tx': `${d.x * 3}px`,
          '--ty': `${d.y * 3}px`,
        } as any} />
      ))}

      {/* ── Radial burst overlay ── */}
      {showSparks && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 35 }}>
          <div style={{
            width: 600, height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168,85,247,0.5) 0%, rgba(250,204,21,0.25) 30%, transparent 70%)',
            animation: 'burstFade 1s ease-out forwards',
          }} />
        </div>
      )}

      {/* ── Main content layout ── */}
      <div className="relative z-30 w-full max-w-5xl flex items-center justify-between px-10">

        {/* ═══ TEAM X ═══ */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1,
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: slideInX ? 'translateX(-120px)' : isExit ? 'translateX(-60px)' : 'translateX(0)',
          opacity: slideInX ? 0 : isExit ? 0 : 1,
        }}>
          {/* Team aura */}
          <div style={{
            position: 'absolute',
            width: 180, height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)',
            animation: 'auraX 2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Symbol badge */}
          <div style={{
            width: 100, height: 100, borderRadius: 20,
            background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
            border: '3px solid #60a5fa',
            boxShadow: '0 0 40px rgba(59,130,246,0.7), 0 0 80px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            animation: isClashOrLater ? 'heroPulseX 0.4s ease-in-out infinite alternate' : 'heroFloat 3s ease-in-out infinite',
          }}>
            <X strokeWidth={5} size={52} color="white" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' }} />
          </div>

          <p style={{
            fontSize: 10, color: '#60a5fa', textTransform: 'uppercase',
            letterSpacing: '0.3em', marginBottom: 4, fontWeight: 800,
            textShadow: '0 0 10px rgba(96,165,250,0.8)',
          }}>Team X</p>

          <p style={{
            fontSize: 22, fontWeight: 900, color: 'white',
            textShadow: '0 0 30px rgba(59,130,246,0.9), 0 0 60px rgba(59,130,246,0.5)',
            letterSpacing: '-0.02em',
            animation: glitch ? 'glitchText 0.3s steps(2) infinite' : 'none',
          }}>
            {teamName}
          </p>

          {/* HP bar */}
          <div style={{
            marginTop: 10, width: 120, height: 6,
            background: 'rgba(30,58,138,0.5)',
            borderRadius: 3, border: '1px solid rgba(59,130,246,0.3)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: '100%',
              background: 'linear-gradient(to right, #1d4ed8, #60a5fa)',
              boxShadow: '0 0 8px #3b82f6',
              animation: 'hpPulse 1.5s ease-in-out infinite',
            }} />
          </div>
        </div>

        {/* ═══ CENTER ═══ */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          minWidth: 160, zIndex: 10,
        }}>
          {/* Countdown */}
          {countdownNum !== null && (
            <div key={countdownNum} style={{
              fontSize: 96, fontWeight: 900, color: 'white',
              textShadow: '0 0 60px rgba(250,204,21,0.4)',
              animation: 'countdownPop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              lineHeight: 1,
            }}>{countdownNum}</div>
          )}

          {/* VS text — shown during clash phases */}
          {(phase === 'clash' || phase === 'reveal') && !countdownNum && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 80, fontWeight: 900, lineHeight: 1,
                background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 40%, #ef4444 80%, #facc15 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 40px rgba(168,85,247,0.9))',
                animation: phase === 'reveal' ? 'vsReveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'vsClash 0.3s ease-out forwards',
              }}>VS</div>

              {isReveal && (
                <div style={{
                  fontSize: 11, color: '#a855f7', textTransform: 'uppercase',
                  letterSpacing: '0.4em', fontWeight: 800,
                  textShadow: '0 0 20px rgba(168,85,247,0.8)',
                  animation: 'fadeSlideUp 0.5s ease-out 0.2s both',
                  marginTop: 8,
                }}>⚔ BATTLE BEGINS ⚔</div>
              )}
            </div>
          )}

          {/* Idle lightning icon */}
          {!countdownNum && !['clash', 'reveal', 'exit'].includes(phase) && (
            <Zap size={36} className="text-yellow-400" fill="currentColor"
              style={{ filter: 'drop-shadow(0 0 16px rgba(250,204,21,0.9))', animation: 'zapPulse 0.8s ease-in-out infinite' }} />
          )}
        </div>

        {/* ═══ TEAM O ═══ */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1,
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: slideInX ? 'translateX(120px)' : isExit ? 'translateX(60px)' : 'translateX(0)',
          opacity: slideInX ? 0 : isExit ? 0 : 1,
        }}>
          {/* Team aura */}
          <div style={{
            position: 'absolute',
            width: 180, height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)',
            animation: 'auraO 2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Symbol badge */}
          <div style={{
            width: 100, height: 100, borderRadius: 20,
            background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
            border: '3px solid #f87171',
            boxShadow: '0 0 40px rgba(239,68,68,0.7), 0 0 80px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            animation: isClashOrLater ? 'heroPulseO 0.4s ease-in-out infinite alternate' : 'heroFloat 3s ease-in-out infinite 0.5s',
          }}>
            <Circle strokeWidth={5} size={50} color="white" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' }} />
          </div>

          <p style={{
            fontSize: 10, color: '#f87171', textTransform: 'uppercase',
            letterSpacing: '0.3em', marginBottom: 4, fontWeight: 800,
            textShadow: '0 0 10px rgba(248,113,113,0.8)',
          }}>Team O</p>

          <p style={{
            fontSize: 22, fontWeight: 900, color: 'white',
            textShadow: '0 0 30px rgba(239,68,68,0.9), 0 0 60px rgba(239,68,68,0.5)',
            letterSpacing: '-0.02em',
            animation: glitch ? 'glitchTextR 0.3s steps(2) infinite' : 'none',
          }}>
            {opponentName}
          </p>

          {/* HP bar */}
          <div style={{
            marginTop: 10, width: 120, height: 6,
            background: 'rgba(127,29,29,0.5)',
            borderRadius: 3, border: '1px solid rgba(239,68,68,0.3)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: '100%',
              background: 'linear-gradient(to right, #b91c1c, #f87171)',
              boxShadow: '0 0 8px #ef4444',
              animation: 'hpPulse 1.5s ease-in-out infinite 0.3s',
            }} />
          </div>
        </div>
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <div style={{
        position: 'absolute', bottom: 32, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: isReveal ? 1 : 0,
        transition: 'opacity 0.5s ease 0.3s',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(168,85,247,0.08)',
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: 50, padding: '8px 24px',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#a855f7',
              boxShadow: '0 0 8px #a855f7',
              animation: `dot 0.6s ease-in-out ${i * 0.15}s infinite alternate`,
            }} />
          ))}
          <span style={{ fontSize: 10, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 700 }}>
            ARENA READY
          </span>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#a855f7',
              boxShadow: '0 0 8px #a855f7',
              animation: `dot 0.6s ease-in-out ${i * 0.15}s infinite alternate`,
            }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes screenShake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          10% { transform: translate(-8px, -4px) rotate(-0.5deg); }
          20% { transform: translate(8px, 4px) rotate(0.5deg); }
          30% { transform: translate(-6px, 6px) rotate(0deg); }
          40% { transform: translate(6px, -6px) rotate(0.3deg); }
          50% { transform: translate(-4px, 2px) rotate(-0.3deg); }
          60% { transform: translate(4px, -2px) rotate(0deg); }
          70% { transform: translate(-3px, 3px) rotate(0.2deg); }
          80% { transform: translate(3px, -1px) rotate(-0.2deg); }
          90% { transform: translate(-1px, 1px) rotate(0deg); }
        }
        @keyframes gridPulse {
          0%,100% { opacity: 0.08; }
          50% { opacity: 0.15; }
        }
        @keyframes flashOut {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes shockRing {
          0% { transform: scale(1); opacity: 1; width: 8px; height: 8px; border-width: 6px; }
          100% { transform: scale(80); opacity: 0; border-width: 1px; }
        }
        @keyframes sparkFly {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          60% { opacity: 0.8; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.2); opacity: 0; }
        }
        @keyframes debrisFly {
          0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) rotate(720deg) scale(0); opacity: 0; }
        }
        @keyframes burstFade {
          0% { transform: scale(0.1); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes beamLeft {
          0% { opacity: 0; transform: scaleX(0); transform-origin: right; }
          20% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; transform: scaleX(1); transform-origin: right; }
        }
        @keyframes beamRight {
          0% { opacity: 0; transform: scaleX(0); transform-origin: left; }
          20% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; transform: scaleX(1); transform-origin: left; }
        }
        @keyframes clashCore {
          0% { transform: scale(0); opacity: 0; }
          15% { transform: scale(2.5); opacity: 1; }
          50% { transform: scale(1.5); opacity: 1; }
          100% { transform: scale(0.5); opacity: 0; }
        }
        @keyframes heroFloat {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes heroPulseX {
          from { box-shadow: 0 0 40px rgba(59,130,246,0.7), 0 0 80px rgba(59,130,246,0.3); }
          to   { box-shadow: 0 0 80px rgba(59,130,246,1.0), 0 0 160px rgba(59,130,246,0.6); }
        }
        @keyframes heroPulseO {
          from { box-shadow: 0 0 40px rgba(239,68,68,0.7), 0 0 80px rgba(239,68,68,0.3); }
          to   { box-shadow: 0 0 80px rgba(239,68,68,1.0), 0 0 160px rgba(239,68,68,0.6); }
        }
        @keyframes auraX {
          0%,100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes auraO {
          0%,100% { transform: scale(1.1); opacity: 0.5; }
          50% { transform: scale(0.9); opacity: 0.9; }
        }
        @keyframes hpPulse {
          0%,100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes countdownPop {
          0% { transform: scale(2.5); opacity: 0; }
          40% { transform: scale(0.9); opacity: 1; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes vsClash {
          0% { transform: scale(2); opacity: 0; }
          100% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes vsReveal {
          0% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes glitchText {
          0%   { clip-path: polygon(0 0,100% 0,100% 35%,0 35%); transform: translate(-4px,0); }
          50%  { clip-path: polygon(0 65%,100% 65%,100% 100%,0 100%); transform: translate(4px,0); }
          100% { clip-path: none; transform: translate(0,0); }
        }
        @keyframes glitchTextR {
          0%   { clip-path: polygon(0 20%,100% 20%,100% 60%,0 60%); transform: translate(4px,0); }
          50%  { clip-path: polygon(0 60%,100% 60%,100% 80%,0 80%); transform: translate(-4px,0); }
          100% { clip-path: none; transform: translate(0,0); }
        }
        @keyframes zapPulse {
          0%,100% { transform: scale(1) rotate(-5deg); filter: drop-shadow(0 0 8px rgba(250,204,21,0.6)); }
          50% { transform: scale(1.15) rotate(5deg); filter: drop-shadow(0 0 24px rgba(250,204,21,1)); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dot {
          from { transform: scale(0.7); opacity: 0.5; }
          to   { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Waiting Lobby ────────────────────────────────────────────────────────────
interface WaitingLobbyProps {
  myTeamName: string;
  mySymbol: 'X' | 'O' | null;
}

function WaitingLobby({ myTeamName, mySymbol }: WaitingLobbyProps) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const interval = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_#1a1a2e_0%,_transparent_60%)]" />
      {/* Animated grid bg */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(114,71,245,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(114,71,245,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 text-center max-w-md px-6">
        {/* My team card */}
        <div className="mb-10">
          <div className={`w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center border-4 shadow-2xl
            ${mySymbol === 'X'
              ? 'bg-gradient-to-br from-blue-600 to-blue-900 border-blue-400 shadow-blue-500/50'
              : 'bg-gradient-to-br from-red-600 to-red-900 border-red-400 shadow-red-500/50'}`}>
            {mySymbol === 'X'
              ? <X strokeWidth={5} size={40} className="text-white" />
              : <Circle strokeWidth={5} size={36} className="text-white" />}
          </div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">You are</p>
          <p className="text-3xl font-black text-white tracking-tight">{myTeamName}</p>
          <Badge className={`mt-2 ${mySymbol === 'X' ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-red-600/20 text-red-400 border-red-500/50'}`}>
            Playing as {mySymbol || '?'}
          </Badge>
        </div>

        {/* VS divider */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-700" />
          <Swords className="w-6 h-6 text-slate-500" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-700" />
        </div>

        {/* Opponent waiting slot */}
        <div className="relative p-6 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/30 overflow-hidden">
          {/* Scan animation */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"
              style={{ animation: 'scanDown 2s linear infinite' }} />
          </div>

          <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center border-2 border-dashed border-slate-700 bg-slate-800/50">
            <Users className="w-6 h-6 text-slate-600" />
          </div>
          <p className="text-slate-400 font-bold text-lg mb-1">Waiting for Opponent{dots}</p>
          <p className="text-slate-600 text-sm">Share your room code to invite the opposing team</p>
        </div>

        <div className="mt-8 flex items-center gap-2 justify-center text-slate-600">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-xs uppercase tracking-widest">Arena Standing By</span>
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        </div>
      </div>

      <style>{`
        @keyframes scanDown {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(2000%); }
        }
      `}</style>
    </div>
  );
}


// ─── Main Game Component ──────────────────────────────────────────────────────
export default function TicTacToeGame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  // sessionStorage keys — scoped to room so different rooms don't share state
  const sessionStateKey = `ttt_state_${room?.code ?? ''}`;
  const sessionBattleKey = `ttt_battle_${room?.code ?? ''}`;

  // 🚀 Pre-load from sessionStorage so the game renders instantly (no blank screen)
  const [state, setState] = useState<GameStateResponse | null>(() => {
    try {
      const c = sessionStorage.getItem(sessionStateKey);
      return c ? (JSON.parse(c) as GameStateResponse) : null;
    } catch { return null; }
  });
  // Only show the "INITIALIZING" spinner when there's truly nothing cached yet
  const [loading, setLoading] = useState(() => {
    try { return !sessionStorage.getItem(sessionStateKey); }
    catch { return true; }
  });
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [lastActionTime, setLastActionTime] = useState(0);

  // Battle animation state
  const [showBattle, setShowBattle] = useState(false);
  const [battleTeamX, setBattleTeamX] = useState("");
  const [battleTeamO, setBattleTeamO] = useState("");
  // 🚀 Persist battle-shown flag in sessionStorage — survives page refresh
  const battleShownRef = useRef(
    typeof window !== 'undefined' &&
    sessionStorage.getItem(sessionBattleKey) === '1'
  );

  // Bonus question state
  const [bonusQ, setBonusQ] = useState<{ id: string; question: string; isReal: boolean; pushedAt: number } | null>(null);
  const [bonusAnswer, setBonusAnswer] = useState("");
  const [bonusSubmitting, setBonusSubmitting] = useState(false);
  const [bonusSolved, setBonusSolved] = useState<'correct' | 'wrong' | null>(null);
  const shownBonusIds = useRef<Set<string>>(new Set());


  // Hardcoded fallback missions with code templates
  const fallbackQuestions = [
    {
      id: "f1",
      text: "Print the sum of 10 and 10 in C.",
      type: 'code',
      language: 'c',
      template: `#include <stdio.h>\n\nint main() {\n  // Print the result using printf\n  printf("20");\n  return 0;\n}`,
      expected: "20",
      is_real: true,
      isSolved: false
    },
    {
      id: "f2",
      text: "Write a function in JS that returns 'bingo'.",
      type: 'code',
      language: 'javascript',
      template: `function solve() {\n  return "";\n}`,
      expected: "bingo",
      is_real: true,
      isSolved: false
    },
    {
      id: "f3",
      text: "Stealth Mission: Print '99' in C++.",
      type: 'code',
      language: 'cpp',
      template: `#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "99";\n  return 0;\n}`,
      expected: "99",
      is_real: false,
      isSolved: false
    },
    {
      id: "f4",
      text: "Print 'CODE' using C.",
      type: 'code',
      language: 'c',
      template: `#include <stdio.h>\n\nint main() {\n  printf("CODE");\n  return 0;\n}`,
      expected: "CODE",
      is_real: true,
      isSolved: false
    },
    {
      id: "f5",
      text: "Stealth: Return true in JS.",
      type: 'code',
      language: 'javascript',
      template: `function solve() {\n  return false;\n}`,
      expected: "true",
      is_real: false,
      isSolved: false
    },
  ];

  const [code, setCode] = useState("");
  const [lastQuestionId, setLastQuestionId] = useState<string | null>(null);

  const tttBoardState = state?.tictactoe;
  const teamIdStr = String(team?.team_id || team?.id || '');
  const solvedArr = (tttBoardState as any)?.solvedByTeam?.[teamIdStr] || [];

  // Map DB questions to the TTT compiler format.
  // DB questions have: question_id, question_text, correct_answer, is_real
  // TTT needs: id, text, type='code', language='c', template, expected, is_real, isSolved
  const C_TEMPLATE = `#include <stdio.h>\n\nint main() {\n  // Write your solution here\n\n  return 0;\n}`;

  const displayQuestions = (state?.questions && state.questions.length > 0)
    ? state.questions.map((q: any) => {
        const qid = String(q.question_id || q.id || '');
        return {
          id: qid,
          text: q.question_text || q.text || 'Solve the mission.',
          type: 'code' as const,
          language: 'c' as const,
          template: C_TEMPLATE,
          expected: (q.correct_answer || q.correctAnswer || '').trim().toLowerCase(),
          is_real: q.is_real !== false,
          isSolved: solvedArr.includes(qid),
        };
      })
    : fallbackQuestions.map(q => ({
        ...q,
        isSolved: solvedArr.includes(q.id)
      }));
  const currentQuestion = displayQuestions[currentQuestionIndex % displayQuestions.length];

  // Reset code when question changes
  useEffect(() => {
    if (currentQuestion?.id !== lastQuestionId) {
      setLastQuestionId(currentQuestion?.id);
      setAnswer("");
      if ((currentQuestion as any).type === 'code') {
        setCode((currentQuestion as any).template || "");
      }
    }
  }, [currentQuestion, lastQuestionId]);

  const teamId = team?.team_id || team?.id;

  const loadState = async () => {
    try {
      if (!room?.code || !teamId) return;
      const res = await fetch(`/api/game?room=${encodeURIComponent(room.code)}&team=${encodeURIComponent(teamId)}`);
      if (res.ok) {
        const data = await res.json();
        // 🚀 Cache fresh state so next mount/refresh is instant
        try { sessionStorage.setItem(sessionStateKey, JSON.stringify(data)); } catch {}
        setState(prev => {
          // Show battle animation when both players are connected
          const wasBothConnected = prev?.tictactoe?.bothConnected;
          const nowBothConnected = data?.tictactoe?.bothConnected;

          // Detect a fresh new game: board is empty and no winner yet
          const boardCells = data?.tictactoe?.board as Record<string, string> | undefined;
          const isFreshGame = boardCells
            ? Object.values(boardCells).every(v => !v) && !data?.tictactoe?.winner
            : !data?.tictactoe?.winner;

          // Reset the battle-shown flag for fresh games so the animation plays again
          if (nowBothConnected && isFreshGame && battleShownRef.current) {
            battleShownRef.current = false;
            try { sessionStorage.removeItem(sessionBattleKey); } catch {}
          }

          if (!wasBothConnected && nowBothConnected && !battleShownRef.current) {
            battleShownRef.current = true;
            sessionStorage.setItem(sessionBattleKey, '1');
            setBattleTeamX(data.tictactoe.teamXName || 'Team X');
            setBattleTeamO(data.tictactoe.teamOName || 'Team O');
            setShowBattle(true);
          }

          // ⚡ Pick up active bonus question from server state
          const serverBonus = data?.tictactoe?.bonusQuestion;
          const myTeamIdStr = String(teamId);
          if (serverBonus && serverBonus.id) {
            const alreadySolvedByMe = (serverBonus.solvedBy || []).includes(myTeamIdStr);
            if (!alreadySolvedByMe && !shownBonusIds.current.has(serverBonus.id)) {
              shownBonusIds.current.add(serverBonus.id);
              setBonusQ({
                id: serverBonus.id,
                question: serverBonus.text,
                isReal: serverBonus.isReal !== false,
                pushedAt: serverBonus.pushedAt || Date.now(),
              });
              setBonusAnswer('');
              setBonusSolved(null);
            }
          }

          return data;
        });
      }
    } catch (error) {
      console.error("Error loading state:", error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!team || !room) {
      navigate("/");
      return;
    }

    loadState(); // initial full load

    // ⚡ SSE: real-time board updates (instant sync between both players)
    let es: EventSource | null = null;
    const connectSSE = () => {
      es = new EventSource(`/api/tictactoe/stream?room=${encodeURIComponent(room.code)}`);

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.type === "battle_start") {
            // Always show animation when SSE fires — this event is broadcast exactly once
            // (when the second player joins), so it's safe to ignore the session key here.
            battleShownRef.current = true;
            sessionStorage.setItem(sessionBattleKey, '1');
            setBattleTeamX(msg.teamXName || 'Team X');
            setBattleTeamO(msg.teamOName || 'Team O');
            setShowBattle(true);
            loadState();
          }

          if (msg.type === "bonus_question") {
            // Only show if we haven't shown this bonus ID yet
            if (!shownBonusIds.current.has(msg.bonusId)) {
              shownBonusIds.current.add(msg.bonusId);
              setBonusQ({ id: msg.bonusId, question: msg.question, isReal: msg.isReal, pushedAt: msg.pushedAt });
              setBonusAnswer("");
              setBonusSolved(null);
              toast({
                title: "⚡ BONUS CHALLENGE INCOMING!",
                description: msg.isReal ? "Solve it for 2× Move Credits!" : "Solve it for 2× Knife Credits!",
                className: "bg-yellow-900 border-yellow-500 text-white",
              });
            }
          }

          if (msg.type === "board_update") {
            setState((prev) => {
              if (!prev?.tictactoe) return prev;
              return {
                ...prev,
                tictactoe: {
                  ...prev.tictactoe,
                  board: msg.board,
                  turn: msg.turn,
                  winner: msg.winner,
                  winByMajority: msg.winByMajority ?? false,
                  movesCredits: msg.movesCredits,
                  knivesCredits: msg.knivesCredits,
                },
              } as any;
            });
          }

          if (msg.type === "credits_update") {
            setState((prev) => {
              if (!prev?.tictactoe) return prev;
              return {
                ...prev,
                tictactoe: {
                  ...prev.tictactoe,
                  movesCredits: msg.movesCredits,
                  knivesCredits: msg.knivesCredits,
                },
              } as any;
            });
          }
        } catch { }
      };

      es.onerror = () => {
        es?.close();
        setTimeout(connectSSE, 2000);
      };
    };

    connectSSE();

    // Slow fallback poll (5s) in case SSE misses something
    const interval = setInterval(loadState, 5000);

    return () => {
      es?.close();
      clearInterval(interval);
    };
  }, []);

  const extractStaticOutput = (src: string, lang: string): string | null => {
    if (lang === 'c') {
      const m = src.match(/printf\s*\(\s*["']([^"'\\]*)["']\s*\)/);
      return m ? m[1] : null;
    }
    if (lang === 'cpp') {
      const m = src.match(/cout\s*<<\s*["']([^"'\\]*)["']/);
      return m ? m[1] : null;
    }
    return null;
  };

  const handleBonusSubmit = async () => {
    if (!bonusQ || !room?.code || !teamId || bonusSubmitting) return;
    setBonusSubmitting(true);
    try {
      const res = await fetch("/api/tictactoe/bonus-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: room.code,
          teamId: String(teamId),
          bonusId: bonusQ.id,
          answer: bonusAnswer.trim(),
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setBonusSolved('correct');
        toast({ title: "Already Solved!", description: "You already got credit for this bonus.", className: "bg-yellow-900 border-yellow-500 text-white" });
        return;
      }
      if (data.correct) {
        setBonusSolved('correct');
        // ── Optimistic update for bonus credits ──
        setState(prev => {
          if (!prev?.tictactoe) return prev;
          const ttt = prev.tictactoe as any;
          const tid = String(teamId);
          const moves = data.movesAwarded || 0;
          const knives = data.knivesAwarded || 0;
          return {
            ...prev,
            tictactoe: {
              ...ttt,
              movesCredits: { ...ttt.movesCredits, [tid]: (ttt.movesCredits?.[tid] || 0) + moves },
              knivesCredits: { ...ttt.knivesCredits, [tid]: (ttt.knivesCredits?.[tid] || 0) + knives },
            },
          };
        });
        toast({
          title: `⚡ BONUS SOLVED! +${data.movesAwarded > 0 ? data.movesAwarded + ' Move' : data.knivesAwarded + ' Knife'} Credits!`,
          description: "Outstanding performance, soldier!",
          className: "bg-green-900 border-green-500 text-white",
        });
        loadState(); // background sync
      } else {
        setBonusSolved('wrong');
        toast({ title: "❌ Wrong Answer", description: "Try again!", variant: "destructive" });
        setTimeout(() => setBonusSolved(null), 2000);
      }
    } catch {
      toast({ title: "Submission failed", variant: "destructive" });
    } finally {
      setBonusSubmitting(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!room?.code || !teamId || !currentQuestion || submitting) return;

    let submissionValue = answer;

    if ((currentQuestion as any).type === 'code') {
      setSubmitting(true);
      try {
        const lang = (currentQuestion as any).language as string;
        const expected = (currentQuestion as any).expected.toLowerCase();

        if (lang === 'javascript') {
          const resultSource = `${code}\n\nfunction generatePattern() { return solve(); }`;
          const result = await executeCode(resultSource);
          if (!result.success) {
            toast({ title: "Execution Failed", description: result.error || "Syntax Error", variant: "destructive" });
            setSubmitting(false);
            return;
          }
          const raw = result.stdout ?? (result.coordinates !== undefined ? String(result.coordinates) : "");
          submissionValue = raw.trim().toLowerCase();
        } else {
          const staticOut = extractStaticOutput(code, lang);
          if (staticOut !== null) {
            submissionValue = staticOut.trim().toLowerCase();
          } else {
            const result = await executeCode(code);
            if (!result.success) {
              toast({ title: "Execution Failed", description: result.error || "Syntax Error", variant: "destructive" });
              setSubmitting(false);
              return;
            }
            submissionValue = (result.stdout || "").trim().toLowerCase();
          }
        }

        if (submissionValue !== expected) {
          toast({
            title: "Wrong Output",
            description: `Expected: "${expected}", Got: "${submissionValue}"`,
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }

        submissionValue = expected;
      } catch (err) {
        toast({ title: "Compiler Error", variant: "destructive" });
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: room.code,
          teamId,
          questionId: currentQuestion.id,
          answer: submissionValue,
        }),
      });

      const result = await res.json();
      if (result.correct) {
        // ── Optimistic update: reflect the new credit instantly, no wait for loadState ──
        setState(prev => {
          if (!prev?.tictactoe) return prev;
          const ttt = prev.tictactoe as any;
          const tid = String(teamId);
          const updated = result.isFake
            ? { knivesCredits: { ...ttt.knivesCredits, [tid]: (ttt.knivesCredits?.[tid] || 0) + 1 } }
            : { movesCredits: { ...ttt.movesCredits, [tid]: (ttt.movesCredits?.[tid] || 0) + 1 } };
          return { ...prev, tictactoe: { ...ttt, ...updated } };
        });
        toast({
          title: result.isFake ? "🔪 KNIFE EARNED!" : "⚔️ MOVE EARNED!",
          description: result.isFake ? "You can now remove an opponent's mark." : "It's your turn to strike!",
          className: result.isFake ? "bg-red-900 border-red-500 text-white" : "bg-blue-900 border-blue-500 text-white",
        });
        setAnswer("");
        setCurrentQuestionIndex((prev) => (prev + 1) % (displayQuestions.length || 1));
        setSubmitting(false);
        loadState(); // background sync
        return;
      } else {
        toast({ title: "❌ INCORRECT", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Submission failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (action: 'move' | 'knife', index: number) => {
    if (Date.now() - lastActionTime < 300) return;
    setLastActionTime(Date.now());

    if (state && t) {
      const newBoard = [...t.board] as (string | null)[];
      if (action === 'move') {
        newBoard[index] = t.yourSymbol;
      } else if (action === 'knife') {
        newBoard[index] = null;
      }

      const newState = {
        ...state,
        tictactoe: {
          ...t,
          board: newBoard,
          movesCredits: action === 'move'
            ? { ...(t as any).movesCredits, [teamIdStr]: Math.max(0, moveCredits - 1) }
            : (t as any).movesCredits,
          knivesCredits: action === 'knife'
            ? { ...(t as any).knivesCredits, [teamIdStr]: Math.max(0, knifeCredits - 1) }
            : (t as any).knivesCredits,
        },
      };
      setState(newState as any);
    }

    try {
      const res = await fetch("/api/tictactoe/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: room?.code,
          teamId: String(teamId),
          action,
          index,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Action Failed", description: data.error, variant: "destructive" });
        loadState();
      } else {
        loadState();
      }
    } catch (error) {
      console.error("Action error:", error);
      loadState();
    }
  };


  const t = state?.tictactoe;
  const moveCredits = t ? ((t as any).movesCredits?.[teamIdStr] || 0) : 0;
  const knifeCredits = t ? ((t as any).knivesCredits?.[teamIdStr] || 0) : 0;

  // Derive display names
  const myTeamName = team?.name || team?.team_name || 'My Team';
  const mySymbol = t?.yourSymbol ?? null;
  const opponentName = mySymbol === 'X'
    ? (t?.teamOName || (t?.teamO ? 'Opponent' : null))
    : (t?.teamXName || (t?.teamX ? 'Opponent' : null));

  // Show waiting lobby if opponent hasn't connected yet
  const bothConnected = t?.bothConnected ?? false;
  const showWaiting = !loading && state && t && !bothConnected;

  // Derived bonus state
  const bonusAlreadySolved = bonusSolved === 'correct';

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a2e_0%,_transparent_50%)]" />

      {/* Battle start VS animation */}
      {showBattle && (
        <BattleAnimation
          teamName={battleTeamX}
          opponentName={battleTeamO}
          onDone={() => setShowBattle(false)}
        />
      )}

      {/* Waiting lobby overlay */}
      {showWaiting && !showBattle && (
        <WaitingLobby myTeamName={myTeamName} mySymbol={mySymbol} />
      )}

      <GameHeader
        gameTitle="COMBAT TIC-TAC-TOE"
        gameIcon="⚔️"
        team={team}
        room={room}
        extraInfo={
          <div className="flex gap-4">
            <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/50 px-3 py-1 flex gap-2 items-center">
              <Zap className="w-4 h-4" /> MOVE CREDITS: {moveCredits}
            </Badge>
            <Badge className="bg-red-600/20 text-red-400 border-red-500/50 px-3 py-1 flex gap-2 items-center">
              <Scissors className="w-4 h-4" /> KNIVES: {knifeCredits}
            </Badge>
          </div>
        }
      />

      <main className="relative z-10 h-[calc(100vh-60px)] flex flex-col px-4 lg:px-6 py-4 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 space-y-4">
            <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-slate-400 font-mono tracking-widest animate-pulse">INITIALIZING ARENA...</p>
          </div>
        ) : !state || !t ? (
          <div className="flex flex-col items-center justify-center flex-1 space-y-4 text-center">
            <AlertCircle className="w-16 h-16 text-red-500/50 mb-2" />
            <h3 className="text-xl font-bold">COMMUNICATION FAILURE</h3>
            <p className="text-slate-400 max-w-md">Failed to establish connection with the game server. Please ensure the room code is correct and try again.</p>
            <Button onClick={() => navigate("/")} variant="outline" className="mt-4">RETURN TO BASE</Button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
            {/* ══ LEFT PANEL ══ */}
            <div className="flex flex-col gap-4 min-h-0 overflow-y-auto xl:overflow-hidden">

              {/* ── Battle Info (compact horizontal) ── */}
              <Card className="shrink-0 px-4 py-3 bg-[#0f0f1a]/80 border-slate-800 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <Swords className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0">VS</span>

                  {/* MY TEAM */}
                  <div className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border
                    ${mySymbol === 'X' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0
                      ${mySymbol === 'X' ? 'bg-blue-600/20' : 'bg-red-600/20'}`}>
                      {mySymbol === 'X' ? <X strokeWidth={4} size={14} className="text-blue-400" /> : <Circle strokeWidth={4} size={13} className="text-red-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">YOU</p>
                      <p className="text-xs font-bold text-white truncate">{myTeamName}</p>
                    </div>
                  </div>

                  <span className="text-slate-700 font-black text-sm shrink-0">⚔</span>

                  {/* OPPONENT */}
                  <div className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border
                    ${!bothConnected ? 'border-dashed border-slate-700 bg-slate-900/20' :
                      mySymbol === 'X' ? 'bg-red-500/5 border-red-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                    {!bothConnected ? (
                      <>
                        <div className="w-7 h-7 rounded-md flex items-center justify-center border border-dashed border-slate-700 shrink-0">
                          <Users size={12} className="text-slate-600" />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">OPP</p>
                          <div className="flex gap-0.5 items-center">
                            {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0
                          ${mySymbol === 'X' ? 'bg-red-600/20' : 'bg-blue-600/20'}`}>
                          {mySymbol === 'X' ? <Circle strokeWidth={4} size={13} className="text-red-400" /> : <X strokeWidth={4} size={14} className="text-blue-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">OPP</p>
                          <p className="text-xs font-bold text-white truncate">{opponentName}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Live status dot */}
                  <div className={`shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold ${
                    bothConnected ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${bothConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
                    {bothConnected ? 'LIVE' : 'WAIT'}
                  </div>
                </div>
              </Card>

              {/* ── Mission Control (fills all remaining left-panel height) ── */}
              <Card className="flex-1 min-h-0 flex flex-col p-5 bg-[#0f0f1a]/80 border-slate-800 backdrop-blur-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4 shrink-0">
                  <div className="p-2 bg-purple-500/10 rounded-lg shrink-0">
                    <HelpCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold tracking-tight">MISSION CONTROL</h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Solve to earn power</p>
                  </div>
                  {/* Question counter */}
                  {currentQuestion && (
                    <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-800/60 px-2 py-1 rounded-md">
                      {currentQuestionIndex + 1} / {displayQuestions.length}
                    </span>
                  )}
                </div>

                {currentQuestion ? (
                  <div className="flex-1 min-h-0 flex flex-col gap-4">
                    {/* ── Question text (scrollable if long) ── */}
                    <div className={`shrink-0 max-h-48 overflow-y-auto p-4 rounded-xl border relative group transition-all custom-scroll ${
                      currentQuestion.isSolved ? 'bg-green-500/10 border-green-500/50' : 'bg-black/40 border-slate-800/50'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={`text-[10px] ${
                          currentQuestion.is_real ? 'border-blue-500/50 text-blue-400' : 'border-red-500/50 text-red-400'
                        }`}>
                          MISSION: {currentQuestion.is_real ? "ASSAULT (MOVE CREDIT)" : "STEALTH (KNIFE CREDIT)"}
                        </Badge>
                        {currentQuestion.isSolved && (
                          <Badge className="bg-green-600 text-white animate-pulse text-[10px]">SOLVED ✓</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-100 leading-relaxed font-mono whitespace-pre-wrap">
                        {currentQuestion.text}
                      </p>
                    </div>

                    {/* ── Code Editor / Answer Input (flex-1 = fills remaining height) ── */}
                    <div className="flex-1 min-h-0 flex flex-col">
                      {(currentQuestion as any).type === 'code' ? (
                        <div className="flex-1 min-h-0 flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-[#1e1e1e]">
                          {/* Editor toolbar */}
                          <div className="shrink-0 bg-[#2d2d2d] px-4 py-2 flex justify-between items-center border-b border-slate-800">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">
                                {(currentQuestion as any).language?.toUpperCase() || 'C'} COMPILER
                              </span>
                            </div>
                          </div>
                          {/* Monaco fills leftover height */}
                          <div className="flex-1 min-h-0">
                            <Editor
                              height="100%"
                              language={(currentQuestion as any).language || "c"}
                              value={code}
                              onChange={(v) => setCode(v || "")}
                              theme="vs-dark"
                              options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: "'Fira Code', monospace",
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 12, bottom: 12 },
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <Input
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
                          placeholder="ENTER SOLUTION..."
                          className="bg-black/60 border-slate-800 h-12 font-mono focus:border-purple-500 transition-colors"
                        />
                      )}
                    </div>

                    {/* ── Tactical status + nav/submit row ── */}
                    <div className="shrink-0 flex flex-col gap-3">
                      {/* Status pills */}
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center justify-between bg-black/20 px-3 py-2 rounded-lg border border-slate-800/50">
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Symbol</span>
                          <span className={`font-black text-sm ${t.yourSymbol === 'X' ? 'text-blue-400' : 'text-red-400'}`}>{t.yourSymbol || '—'}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-between bg-black/20 px-3 py-2 rounded-lg border border-slate-800/50">
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Status</span>
                          <span className={`font-black text-[10px] ${moveCredits > 0 ? 'text-green-400 animate-pulse' : 'text-slate-500'}`}>
                            {moveCredits > 0 ? '⚡ READY' : 'NEED AMMO'}
                          </span>
                        </div>
                      </div>
                      {/* Nav + submit */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentQuestionIndex((prev) => (prev - 1 + displayQuestions.length) % displayQuestions.length)}
                          className="w-16 bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white text-xs"
                        >◀ PREV</Button>
                        <Button
                          onClick={handleSubmitAnswer}
                          disabled={submitting}
                          className="flex-1 h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-0 shadow-[0_0_20px_rgba(114,71,245,0.3)] font-bold tracking-widest text-sm"
                        >
                          {submitting ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> VERIFYING...</span> : '⚡ EXECUTE'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setCurrentQuestionIndex((prev) => (prev + 1) % displayQuestions.length)}
                          className="w-16 bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white text-xs"
                        >NEXT ▶</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <Trophy className="w-12 h-12 text-yellow-500 mb-4 animate-bounce" />
                    <p className="text-slate-400 font-mono uppercase tracking-widest">All Missions Complete</p>
                  </div>
                )}
              </Card>
            </div>

            {/* ══ RIGHT PANEL (Arena) ══ */}
            <div className="flex flex-col min-h-0 overflow-y-auto xl:overflow-hidden">
              <div className="flex flex-col items-center justify-center h-full relative gap-6 py-2">

                {/* ⚡ BONUS QUESTION OVERLAY */}
                {bonusQ && !bonusAlreadySolved && (
                  <div className="w-full mb-6 relative">
                    <div
                      className="relative rounded-2xl overflow-hidden border-2 border-yellow-500/60 shadow-[0_0_40px_rgba(234,179,8,0.3)]"
                      style={{ background: 'linear-gradient(135deg, #1a1500 0%, #0f0f00 50%, #1a0800 100%)' }}
                    >
                      {/* Animated top glow bar */}
                      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, transparent, #f59e0b, #ea580c, #f59e0b, transparent)', animation: 'shimmer 2s linear infinite' }} />

                      {/* Header */}
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-yellow-500/20">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-3 h-3 rounded-full bg-yellow-400 animate-ping" style={{ animationDuration: '0.8s' }} />
                          <span className="text-yellow-400 font-black text-sm uppercase tracking-widest">⚡ LIVE BONUS CHALLENGE</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${bonusQ.isReal
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                            : 'bg-red-600/20 border-red-500/50 text-red-400'
                            }`}>
                            {bonusQ.isReal ? '⚔️ +2 MOVE CREDITS' : '🔪 +2 KNIFE CREDITS'}
                          </span>
                          <button
                            onClick={() => setBonusQ(null)}
                            className="text-slate-600 hover:text-slate-400 text-lg leading-none ml-1"
                            title="Dismiss"
                          >✕</button>
                        </div>
                      </div>

                      {/* Question body */}
                      <div className="px-5 py-4">
                        <p className="text-white font-mono text-sm leading-relaxed whitespace-pre-wrap bg-black/30 border border-yellow-500/20 rounded-xl p-4">
                          {bonusQ.question}
                        </p>
                      </div>

                      {/* Answer input */}
                      <div className="px-5 pb-5 flex gap-3 items-center">
                        <input
                          value={bonusAnswer}
                          onChange={e => setBonusAnswer(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleBonusSubmit()}
                          placeholder="Enter your answer..."
                          className={`flex-1 rounded-xl border px-4 py-2.5 bg-black/60 text-white font-mono text-sm focus:outline-none transition-all ${bonusSolved === 'wrong' ? 'border-red-500 focus:border-red-400' : 'border-yellow-500/40 focus:border-yellow-400'
                            }`}
                          disabled={bonusSubmitting || bonusAlreadySolved}
                        />
                        <button
                          onClick={handleBonusSubmit}
                          disabled={bonusSubmitting || !bonusAnswer.trim() || bonusAlreadySolved}
                          className="relative px-5 py-2.5 rounded-xl font-black text-sm overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                          style={{
                            background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                            boxShadow: '0 0 20px rgba(245,158,11,0.4)',
                          }}
                        >
                          {bonusSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : '⚡ SUBMIT'}
                        </button>
                      </div>
                    </div>
                    <style>{`
                      @keyframes shimmer {
                        0% { background-position: -200% center; }
                        100% { background-position: 200% center; }
                      }
                    `}</style>
                  </div>
                )}


                {/* Cinematic Background Grid */}
                <div className="absolute inset-0 grid grid-cols-3 gap-0 opacity-10 pointer-events-none">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-purple-500/20" />
                  ))}
                </div>

                {t.winner && (() => {
                  const xCells = t.board.filter(c => c === 'X').length;
                  const oCells = t.board.filter(c => c === 'O').length;
                  const winnerName = t.winner === t.yourSymbol ? 'YOU' : (t.winner === 'X' ? (t.teamXName || 'Team X') : (t.teamOName || 'Team O'));
                  return (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-3xl animate-in fade-in zoom-in">
                      <div className="text-center p-8 bg-slate-900 border-2 border-yellow-500/50 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                        <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-5xl font-black mb-2 tracking-tighter">VICTORY</h2>
                        <p className="text-2xl text-yellow-400 mb-2 uppercase">{winnerName} DOMINATED THE ARENA</p>
                        {t.winByMajority && (
                          <p className="text-sm text-slate-400 mb-4 font-mono">
                            Won by majority &nbsp;·&nbsp;
                            <span className="text-blue-400">✕ {xCells}</span>
                            &nbsp;vs&nbsp;
                            <span className="text-red-400">○ {oCells}</span>
                            &nbsp;cells
                          </p>
                        )}
                        <Button onClick={() => window.location.reload()} variant="outline" className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10">
                          WAIT FOR NEXT ROUND
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                {/* TTT GRID */}
                <div className="grid grid-cols-3 gap-3 p-6 bg-slate-900/40 rounded-[2rem] border-4 border-slate-800/50 shadow-[0_0_100px_rgba(0,0,0,0.5)] backdrop-blur-md">
                  {t.board.map((cell, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (knifeCredits > 0 && cell && cell !== t.yourSymbol) {
                          handleAction('knife', i);
                        } else if (moveCredits > 0 && !cell) {
                          handleAction('move', i);
                        } else if (!cell) {
                          if (moveCredits <= 0) {
                            toast({ title: "No Credits", description: "Solve a question to earn a move!", variant: "destructive" });
                          }
                        } else if (cell && cell !== t.yourSymbol && knifeCredits <= 0) {
                          toast({ title: "No Knives", description: "Solve stealth missions to earn a knife!", variant: "destructive" });
                        }
                      }}
                      className={`
                      w-[clamp(5rem,10vw,8rem)] h-[clamp(5rem,10vw,8rem)] font-black rounded-2xl flex items-center justify-center transition-all duration-500 relative group
                      ${!cell && moveCredits > 0 ? "cursor-pointer hover:bg-blue-500/10" : "cursor-default"}
                      ${cell === 'X' ? "text-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2)]" : ""}
                      ${cell === 'O' ? "text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]" : ""}
                      ${!cell ? "bg-[#0a0a14] border-2 border-slate-800" : "bg-[#121225] border-2 border-slate-700"}
                      ${cell && cell !== t.yourSymbol ? "cursor-pointer" : ""}
                    `}
                    >
                      <div className="animate-in zoom-in duration-300">
                        {cell === 'X' && <X strokeWidth={6} className="w-[clamp(2.5rem,5vw,4rem)] h-[clamp(2.5rem,5vw,4rem)]" />}
                        {cell === 'O' && <Circle strokeWidth={6} className="w-[clamp(2.5rem,5vw,4rem)] h-[clamp(2.5rem,5vw,4rem)]" />}
                      </div>

                      {cell && cell !== t.yourSymbol && knifeCredits > 0 && (
                        <div className="absolute -top-4 -right-4 bg-red-600 text-[10px] font-bold px-2 py-1 rounded-md animate-bounce">
                          KNIFE TARGET
                        </div>
                      )}

                      {!cell && t.turn === t.yourSymbol && moveCredits > 0 && (
                        <div className="opacity-0 group-hover:opacity-10 transition-opacity">
                          {t.yourSymbol === 'X' ? <X size={64} /> : <Circle size={64} />}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Battle Progress Footer */}
                <div className="w-full max-w-lg">
                  <div className="bg-[#0f0f1a]/80 border border-slate-800 rounded-2xl px-6 py-4 backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-px bg-slate-800" />
                      <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-500">Battle Progress</span>
                      <div className="flex-1 h-px bg-slate-800" />
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Team X */}
                      <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
                        <p className="text-[10px] text-slate-500 uppercase truncate max-w-[72px]">{t.teamXName || 'Team X'}</p>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${
                          t.turn === 'X'
                            ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_16px_rgba(59,130,246,0.5)]'
                            : 'border-slate-800 bg-slate-900/50'
                        }`}>
                          <X size={18} className={t.turn === 'X' ? 'text-blue-400' : 'text-slate-700'} />
                        </div>
                        {t.turn === 'X' && <span className="text-[9px] text-blue-400 animate-pulse font-bold">THEIR TURN</span>}
                        {t.turn === t.yourSymbol && t.yourSymbol === 'X' && <span className="text-[9px] text-green-400 animate-pulse font-bold">YOUR TURN</span>}
                      </div>

                      {/* Progress bar */}
                      <div className="flex-1">
                        <Progress value={t.board.filter(c=>c).length * 11.11} className="h-2 bg-slate-800" />
                        <p className="text-center text-[10px] text-slate-600 mt-1.5">{t.board.filter(c=>c).length} / 9 cells filled</p>
                      </div>

                      {/* Team O */}
                      <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
                        <p className="text-[10px] text-slate-500 uppercase truncate max-w-[72px]">{t.teamOName || (t.teamO ? 'Team O' : 'Waiting…')}</p>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${
                          t.turn === 'O'
                            ? 'border-red-500 bg-red-500/10 shadow-[0_0_16px_rgba(239,68,68,0.5)]'
                            : 'border-slate-800 bg-slate-900/50'
                        }`}>
                          <Circle size={18} className={t.turn === 'O' ? 'text-red-400' : 'text-slate-700'} />
                        </div>
                        {t.turn === 'O' && <span className="text-[9px] text-red-400 animate-pulse font-bold">THEIR TURN</span>}
                        {t.turn === t.yourSymbol && t.yourSymbol === 'O' && <span className="text-[9px] text-green-400 animate-pulse font-bold">YOUR TURN</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Global CSS for animations */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .scanline {
          height: 2px;
          background: rgba(114, 71, 245, 0.1);
          animation: scan 4s linear infinite;
        }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 99px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.6); }
      `}</style>
    </div>
  );
}
