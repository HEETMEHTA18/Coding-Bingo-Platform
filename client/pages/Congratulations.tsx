import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameStateResponse, LeaderboardResponse, Team } from "@shared/api";
import { apiFetch } from "../lib/api";

/* Simple confetti particle */
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#a855f7", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#06b6d4"];
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      vy: Math.random() * 3 + 2,
      vx: (Math.random() - 0.5) * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.2,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y += p.vy; p.x += p.vx; p.rot += p.rotV;
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.globalAlpha = 0.8;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ opacity: 0.7 }} />;
}

export default function CongratulationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const rawTeam = localStorage.getItem("bingo.team");
    const rawRoom = localStorage.getItem("bingo.room");
    let t: Team | null = null;
    let room: { code: string } | null = null;
    try { t = rawTeam && rawTeam !== "undefined" && rawTeam !== "null" ? JSON.parse(rawTeam) : null; } catch { }
    try { room = rawRoom && rawRoom !== "undefined" && rawRoom !== "null" ? JSON.parse(rawRoom) : null; } catch { }
    if (!t || !room) { navigate("/"); return; }
    setTeam(t);

    (async () => {
      try {
        const stateRes = await apiFetch(`/api/game-state?teamId=${encodeURIComponent(t.team_id)}`);
        const state = (await stateRes.json()) as GameStateResponse;
        if (state.team.lines_completed < 5) { setAllowed(false); setLoading(false); return; }
        setAllowed(true);
        const lbRes = await apiFetch(`/api/leaderboard?room=${encodeURIComponent(room!.code)}`);
        const lb = (await lbRes.json()) as LeaderboardResponse;
        const my = lb.rows.find((r) => r.team.team_name === t.name);
        setRank(my?.rank ?? null);
      } finally {
        setLoading(false);
        setTimeout(() => setVisible(true), 100);
      }
    })();
  }, [navigate]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(224,20%,5%)" }}>
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto" />
        <p className="font-mono text-slate-500 tracking-widest text-sm animate-pulse">LOADING RESULTS...</p>
      </div>
    </div>
  );

  if (!allowed) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "hsl(224,20%,5%)" }}>
      <div className="text-center rounded-2xl p-8 w-full max-w-md" style={{ background: "rgba(15,15,30,0.9)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-black text-red-400 mb-2" style={{ fontFamily: "'Orbitron',sans-serif" }}>ACCESS DENIED</h1>
        <p className="text-slate-400 text-sm mb-6">Complete 5 bingo lines to unlock this page</p>
        <button onClick={() => navigate("/game")} className="px-6 py-2.5 rounded-xl font-bold text-white text-sm" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>← Return to Battle</button>
      </div>
    </div>
  );

  const rankLabel = rank === 1 ? "🥇 CHAMPION" : rank === 2 ? "🥈 RUNNER UP" : rank === 3 ? "🥉 THIRD PLACE" : rank ? `#${rank} RANK` : "WINNER";
  const rankColor = rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : rank === 3 ? "#d97706" : "#a855f7";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%,rgba(109,40,217,0.35) 0%,transparent 60%),hsl(224,20%,5%)" }}>

      <Confetti />

      {/* Radial glow behind card */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle,rgba(245,158,11,0.6),transparent 70%)" }} />
      </div>

      {/* Main card */}
      <div className={`relative w-full max-w-md transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        {/* Glow border */}
        <div className="absolute -inset-px rounded-2xl" style={{ background: `linear-gradient(135deg,${rankColor}80,rgba(139,92,246,0.4),${rankColor}40)`, filter: "blur(1px)" }} />

        <div className="relative rounded-2xl p-8 text-center" style={{ background: "rgba(8,8,18,0.95)", border: `1px solid ${rankColor}40` }}>

          {/* Trophy / rank icon */}
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 rounded-full blur-xl opacity-60 animate-pulse" style={{ background: rankColor }} />
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto" style={{ background: `radial-gradient(circle,${rankColor}60,${rankColor}20)`, boxShadow: `0 0 40px ${rankColor}60` }}>
              {rank === 1 ? "👑" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏆"}
            </div>
          </div>

          {/* Rank badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-4" style={{ background: `${rankColor}20`, border: `1px solid ${rankColor}50`, color: rankColor }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: rankColor }} />
            {rankLabel}
          </div>

          {/* Title */}
          <h1 className="text-4xl font-black text-white mb-1" style={{ fontFamily: "'Orbitron',sans-serif" }}>
            VICTORY!
          </h1>
          <p className="text-slate-400 text-sm mb-6">You completed the BINGO challenge!</p>

          {/* Team info */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs text-slate-500 font-mono tracking-widest mb-1">TEAM</p>
            <p className="text-xl font-black text-white">{team?.team_name || team?.name}</p>
            {rank && (
              <p className="text-sm font-mono mt-1" style={{ color: rankColor }}>Ranked #{rank} on the leaderboard</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={() => navigate("/leaderboard", { state: { fromCongratulations: true } })}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 20px rgba(139,92,246,0.35)" }}>
              🏆 Leaderboard
            </button>
            <button onClick={() => navigate("/game")}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-300 transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              🎮 Play Again
            </button>
          </div>

          {/* Decorative lines */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ background: `linear-gradient(90deg,transparent,${rankColor}60,transparent)` }} />
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
