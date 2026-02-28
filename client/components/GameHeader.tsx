// Unified Game Header Component — GAMING EDITION
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Team, Room } from "@shared/api";
import { clearGameData } from "../lib/localStorage";

interface GameHeaderProps {
  gameTitle: string;
  gameIcon: string;
  team: Team | null;
  room: Room | null;
  extraInfo?: React.ReactNode;
  showAchievements?: boolean;
  showLeaderboard?: boolean;
  hideRoomTimer?: boolean;
}

export default function GameHeader({
  gameTitle, gameIcon, team, room, extraInfo,
  showAchievements = true, showLeaderboard = true, hideRoomTimer = false,
}: GameHeaderProps) {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<"not-started" | "active" | "ended">("not-started");
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!room?.roundEndAt) { setGameStatus("not-started"); setTimeLeft(null); return; }
    const updateTimer = () => {
      const diff = new Date(room.roundEndAt!).getTime() - Date.now();
      if (diff <= 0) { setGameStatus("ended"); setTimeLeft("00:00:00"); return; }
      setGameStatus("active");
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      // Flash every second
      setPulse((p) => !p);
    };
    updateTimer();
    const iv = setInterval(updateTimer, 1000);
    return () => clearInterval(iv);
  }, [room?.roundEndAt]);

  const handleLogout = () => { clearGameData(); navigate("/"); };

  const timerColor =
    gameStatus === "ended" ? "#ef4444" :
      gameStatus === "active" ? "#22c55e" : "#64748b";

  return (
    <header className="sticky top-0 z-50"
      style={{
        background: "rgba(7,8,18,0.85)",
        borderBottom: "1px solid rgba(139,92,246,0.2)",
        backdropFilter: "blur(24px)",
        boxShadow: "0 4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.05) inset",
      }}>

      {/* Top neon accent line */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(139,92,246,0.6),rgba(6,182,212,0.4),transparent)" }} />

      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">

          {/* ── LEFT: Logo + title + team info ── */}
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-md opacity-60 animate-pulse"
                style={{ background: "radial-gradient(circle,rgba(139,92,246,0.8),transparent)" }} />
              <div className="relative w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg"
                style={{ background: "linear-gradient(135deg,#4c1d95,#7c3aed,#4f46e5)", border: "1px solid rgba(139,92,246,0.4)" }}>
                {gameIcon}
              </div>
            </div>

            {/* Game title + info */}
            <div>
              <h1 className="font-black text-lg leading-tight tracking-wider"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: "linear-gradient(90deg,#c4b5fd,#f0abfc,#67e8f9)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                {gameTitle}
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {/* Team badge */}
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-purple-300"
                  style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                  👾 {team?.name || team?.team_name || "..."}
                </span>
                {/* Room badge */}
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-cyan-300"
                  style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)" }}>
                  # {room?.code || "..."}
                </span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: timer + actions ── */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Extra info slot (credits, etc.) */}
            {extraInfo && <div className="flex items-center gap-2">{extraInfo}</div>}

            {/* Timer */}
            {!hideRoomTimer && timeLeft && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-black text-sm"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  border: `1px solid ${timerColor}40`,
                  boxShadow: `0 0 12px ${timerColor}20`,
                  color: timerColor,
                  fontFamily: "'Orbitron', monospace",
                }}>
                <span className={`w-2 h-2 rounded-full ${pulse ? "opacity-100" : "opacity-30"} transition-opacity`}
                  style={{ background: timerColor }} />
                {timeLeft}
              </div>
            )}

            {/* Achievements */}
            {showAchievements && (
              <NavBtn onClick={() => navigate("/achievements")} icon="🏆" label="Awards"
                color="rgba(245,158,11,0.2)" border="rgba(245,158,11,0.4)" text="text-amber-400" />
            )}

            {/* Leaderboard */}
            {showLeaderboard && (
              <NavBtn onClick={() => navigate("/leaderboard")} icon="📊" label="Board"
                color="rgba(6,182,212,0.15)" border="rgba(6,182,212,0.35)" text="text-cyan-400" />
            )}

            {/* Separator */}
            <div className="h-8 w-px mx-1" style={{ background: "rgba(139,92,246,0.3)" }} />

            {/* Exit */}
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-red-400 transition-all duration-200 hover:scale-105 group"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.boxShadow = "0 0 16px rgba(239,68,68,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.boxShadow = ""; }}>
              <span className="group-hover:rotate-12 transition-transform text-base">🚪</span>
              <span className="hidden sm:inline">EXIT</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavBtn({ onClick, icon, label, color, border, text }: {
  onClick: () => void; icon: string; label: string;
  color: string; border: string; text: string;
}) {
  return (
    <button onClick={onClick}
      className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 hover:scale-105 ${text}`}
      style={{ background: color, border: `1px solid ${border}` }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 16px ${border}80`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}>
      <span className="text-base">{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
