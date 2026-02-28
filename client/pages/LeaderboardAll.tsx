import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Team } from "@shared/api";
import { apiFetch } from "../lib/api";

/* ─── types ─── */
interface RoomData {
  room: { code: string; title: string; gameType: string; roundEndAt: string | null };
  rows: Array<{ team: Team; rank: number }>;
  winner: Team | null;
  teamCount: number;
  hasWinner: boolean;
}
type AllData = Record<string, RoomData>;

/* ─── helpers ─── */
function fmt(ms: number) {
  if (!ms) return "—";
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const RANK_META = [
  { bg: "linear-gradient(135deg,#f59e0b,#d97706)", shadow: "0 0 16px rgba(245,158,11,0.5)", label: "🥇" },
  { bg: "linear-gradient(135deg,#94a3b8,#64748b)", shadow: "0 0 12px rgba(148,163,184,0.4)", label: "🥈" },
  { bg: "linear-gradient(135deg,#d97706,#92400e)", shadow: "0 0 12px rgba(217,119,6,0.4)", label: "🥉" },
];

/* ══════════════════════════════════════════════════════ */
export default function LeaderboardAllPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AllData>({});
  const [openRooms, setOpenRooms] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/leaderboard/all");
      if (!res.ok) return;
      const d = (await res.json()) as AllData;
      setData(d);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const toggle = (code: string) =>
    setOpenRooms(prev => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });

  const rooms = Object.entries(data).filter(([c]) => c.toLowerCase().includes(search.toLowerCase()));
  const totalTeams = rooms.reduce((a, [, d]) => a + d.teamCount, 0);
  const totalWinners = rooms.filter(([, d]) => d.hasWinner).length;

  const CARD = "rgba(12,12,25,0.85)";

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse 90% 50% at 50% -10%,rgba(99,40,217,0.22) 0%,transparent 55%),hsl(224,20%,5%)" }}>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(99,102,241,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.025) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(7,8,18,0.93)", borderBottom: "1px solid rgba(139,92,246,0.2)", backdropFilter: "blur(24px)" }}>
        <div className="h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(139,92,246,0.6),rgba(6,182,212,0.4),transparent)" }} />
        <div className="container py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-md opacity-70 animate-pulse" style={{ background: "rgba(139,92,246,0.7)" }} />
              <div className="relative w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>🌍</div>
            </div>
            <div>
              <h1 className="font-black text-xl tracking-wider" style={{ fontFamily: "'Orbitron',sans-serif", background: "linear-gradient(90deg,#c4b5fd,#f0abfc,#67e8f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ALL ARENAS
              </h1>
              <p className="text-xs font-mono text-slate-500">
                <span className="text-purple-400">{rooms.length} rooms</span> &nbsp;·&nbsp;
                <span className="text-cyan-400">{totalTeams} teams</span> &nbsp;·&nbsp;
                <span className="text-green-400">{totalWinners} winners</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())} placeholder="SEARCH ROOM..." className="pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono w-36" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.3)", color: "white" }} />
            </div>
            <button onClick={() => navigate("/admin")} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 16px rgba(139,92,246,0.3)" }}>
              ← Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-4 relative z-10">
        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="font-mono text-slate-500 text-xs tracking-widest">SCANNING ARENAS...</p>
          </div>
        )}

        {/* Room cards */}
        {!loading && rooms.map(([roomCode, roomData]) => {
          const isOpen = openRooms.has(roomCode);
          const hw = roomData.hasWinner;
          const borderColor = hw ? "rgba(34,197,94,0.4)" : "rgba(139,92,246,0.25)";
          const glowColor = hw ? "rgba(34,197,94,0.08)" : "transparent";

          return (
            <div key={roomCode} className="rounded-2xl overflow-hidden transition-all duration-300"
              style={{ background: CARD, border: `1px solid ${borderColor}`, boxShadow: hw ? `0 0 30px ${glowColor}` : "none" }}>

              {/* ── Room header row (always visible, click to expand) ── */}
              <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
                onClick={() => toggle(roomCode)}
                style={{ background: isOpen ? "rgba(139,92,246,0.1)" : "transparent" }}>
                <div className="flex items-center gap-4">
                  {/* Color dot */}
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: hw ? "#22c55e" : "#a855f7", boxShadow: `0 0 8px ${hw ? "#22c55e" : "#a855f7"}` }} />

                  {/* Room code */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-base" style={{ fontFamily: "'Orbitron',sans-serif" }}>{roomCode}</span>
                      {roomData.room?.title && roomData.room.title !== roomCode && (
                        <span className="text-xs text-slate-500 font-mono">— {roomData.room.title}</span>
                      )}
                      {hw && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-green-300" style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)" }}>✓ HAS WINNER</span>}
                      {roomData.room?.roundEndAt && <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[9px] font-mono text-cyan-400" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
                        {new Date(roomData.room.roundEndAt) > new Date() ? "⏱ LIVE" : "⏹ ENDED"}
                      </span>}
                    </div>
                    <p className="text-xs font-mono text-slate-600 mt-0.5">{roomData.teamCount} teams competing</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Mini top-3 avatars */}
                  <div className="hidden sm:flex items-center -space-x-2">
                    {roomData.rows.slice(0, 3).map((r, i) => (
                      <div key={r.team.id} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2" style={{ background: RANK_META[i]?.bg ?? "rgba(99,102,241,0.5)", borderColor: "rgba(7,8,18,0.8)", zIndex: 3 - i }}>
                        {r.team.team_name.substring(0, 2).toUpperCase()}
                      </div>
                    ))}
                  </div>

                  {/* Winner name */}
                  {roomData.winner && (
                    <div className="hidden md:flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-amber-400">👑</span>
                      <span className="text-amber-300 font-bold">{roomData.winner.team_name}</span>
                    </div>
                  )}

                  {/* Chevron */}
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300"
                    style={{ background: "rgba(139,92,246,0.15)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* ── Expanded room details ── */}
              {isOpen && (
                <div style={{ borderTop: "1px solid rgba(139,92,246,0.15)" }}>

                  {/* Winner bar */}
                  {roomData.winner && (
                    <div className="px-5 py-3 flex items-center gap-4" style={{ background: "linear-gradient(90deg,rgba(245,158,11,0.12),transparent)", borderBottom: "1px solid rgba(245,158,11,0.15)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl flex-shrink-0 animate-bounce" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 0 16px rgba(245,158,11,0.5)" }}>👑</div>
                      <div>
                        <p className="text-[10px] font-mono text-amber-400 tracking-widest">ROOM CHAMPION</p>
                        <p className="font-black text-white text-sm" style={{ fontFamily: "'Orbitron',sans-serif" }}>{roomData.winner.team_name}</p>
                      </div>
                      <div className="ml-auto flex gap-4 text-xs font-mono text-amber-300">
                        <span>⏱ {fmt(roomData.winner.time_taken_ms || 0)}</span>
                        <span>📏 {roomData.winner.lines_completed}/5</span>
                      </div>
                    </div>
                  )}

                  {/* Team rows — ALL teams */}
                  <div>
                    {roomData.rows.length === 0 && (
                      <div className="py-8 text-center text-slate-600 text-xs font-mono">NO TEAMS YET</div>
                    )}
                    {roomData.rows.map((row, idx) => {
                      const isWinner = (row.team.lines_completed ?? 0) >= 5;
                      // Mark as spectator if 0 lines and no start time (never played)
                      const isSpectator = !row.team.start_time && (row.team.lines_completed ?? 0) === 0;
                      const pct = Math.min(((row.team.lines_completed ?? 0) / 5) * 100, 100);
                      const rm = RANK_META[idx] ?? { bg: "rgba(99,102,241,0.2)", shadow: "none", label: `#${row.rank}` };

                      return (
                        <div key={row.team.id} className="flex items-center gap-4 px-5 py-3 transition-colors"
                          style={{ borderBottom: "1px solid rgba(139,92,246,0.06)" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>

                          {/* Rank badge */}
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                            style={{ background: isSpectator ? "rgba(100,116,139,0.3)" : rm.bg, boxShadow: isSpectator ? "none" : rm.shadow, fontSize: idx < 3 ? "16px" : "11px" }}>
                            {isSpectator ? "👁" : idx < 3 ? rm.label : `#${row.rank}`}
                          </div>

                          {/* Name + progress */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm truncate">{row.team.team_name}</span>
                              {isSpectator && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-slate-400" style={{ background: "rgba(100,116,139,0.2)", border: "1px solid rgba(100,116,139,0.3)" }}>SPECTATOR</span>}
                              {isWinner && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-amber-300" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>✓ WIN</span>}
                            </div>
                            {!isSpectator && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                                  <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: isWinner ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#7c3aed,#a855f7)" }} />
                                </div>
                                <span className="text-[10px] font-mono text-slate-500">{row.team.lines_completed ?? 0}/5</span>
                              </div>
                            )}
                            {isSpectator && <p className="text-[10px] text-slate-600 font-mono mt-0.5">Joined room — not started</p>}
                          </div>

                          {/* Time */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono text-sm font-bold" style={{ color: isSpectator ? "#374151" : "white" }}>
                              {isSpectator ? "—" : row.team.start_time ? fmt(row.team.time_taken_ms || 0) : "—"}
                            </p>
                            <p className="text-[10px]" style={{ color: isWinner ? "#4ade80" : isSpectator ? "#374151" : (row.team.lines_completed ?? 0) > 0 ? "#a5b4fc" : "#374151" }}>
                              {isWinner ? "DONE" : isSpectator ? "SPECTATE" : row.team.start_time ? "LIVE" : "IDLE"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* See full leaderboard + Spectate */}
                  <div className="px-5 py-3 flex gap-2" style={{ borderTop: "1px solid rgba(139,92,246,0.1)" }}>
                    <button onClick={() => navigate(`/leaderboard?room=${roomCode}`)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-purple-300 transition-all hover:text-white"
                      style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
                      🏆 Full Leaderboard →
                    </button>
                    <button onClick={() => navigate(`/spectate?room=${roomCode}`)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all hover:text-white"
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                      👁 Spectate Live →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {!loading && rooms.length === 0 && (
          <div className="py-24 text-center rounded-2xl" style={{ background: CARD, border: "1px solid rgba(139,92,246,0.2)" }}>
            <div className="text-5xl mb-4">🌌</div>
            <p className="font-mono text-slate-500 tracking-widest text-sm">NO ARENAS FOUND</p>
            <p className="text-xs text-slate-700 mt-2">{search ? `No rooms matching "${search}"` : "Create a room from the admin dashboard to get started"}</p>
          </div>
        )}
      </main>
    </div>
  );
}
