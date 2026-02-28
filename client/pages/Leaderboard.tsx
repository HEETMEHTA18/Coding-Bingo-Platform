import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { LeaderboardResponse, Room, Team } from "@shared/api";
import { apiFetch } from "../lib/api";

function formatTime(ms: number) {
  if (!ms || ms === 0) return "0:00";
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("bingo.admin") === "true";

  /* ── room state: URL ?room= wins, then localStorage ── */
  const [room, setRoom] = useState<Room | null>(() => {
    const q = new URLSearchParams(window.location.search).get("room")?.trim();
    if (q) return { code: q.toUpperCase(), title: q.toUpperCase(), roundEndAt: null } as Room;
    try {
      const r = localStorage.getItem("bingo.room");
      if (r && r !== "undefined" && r !== "null") return JSON.parse(r) as Room;
    } catch { }
    return null;
  });

  /* team for "YOU" highlight */
  const [team] = useState<Team | null>(() => {
    try {
      const r = localStorage.getItem("bingo.team");
      if (r && r !== "undefined" && r !== "null") return JSON.parse(r) as Team;
    } catch { }
    return null;
  });

  const [rows, setRows] = useState<LeaderboardResponse["rows"]>([]);
  const [search, setSearch] = useState("");
  const [roomInput, setRoomInput] = useState(room?.code ?? "");

  /* ── use a ref so setInterval always sees the latest room ── */
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

  /* ── load function always reads from ref → no stale closure ── */
  const load = useCallback(async () => {
    const cur = roomRef.current;
    if (!cur?.code) return;
    try {
      const res = await apiFetch(`/api/leaderboard?room=${encodeURIComponent(cur.code)}`);
      if (!res.ok) return;
      const data = (await res.json()) as LeaderboardResponse;
      setRows(data.rows ?? []);
    } catch (err) {
      console.error("Leaderboard load error:", err);
    }
  }, []);   // stable — reads from ref

  /* trigger load whenever room.code changes or on first mount */
  useEffect(() => {
    roomRef.current = room;
    setRows([]);
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [room?.code, load]);

  /* redirect non-admin with no room */
  useEffect(() => {
    if (!room && !isAdmin) navigate("/");
  }, [room, isAdmin, navigate]);

  const filteredRows = rows.filter(r =>
    r.team.team_name.toLowerCase().includes(search.toLowerCase())
  );
  // Detect if this room is TTT (any row has ttt_role set)
  const isTTTRoom = rows.some(r => (r.team as any).ttt_role !== undefined && (r.team as any).ttt_role !== null);
  const hasWinner = isTTTRoom
    ? rows.some(r => (r.team as any).ttt_winner === true)
    : rows.some(r => (r.team.lines_completed ?? 0) >= 5);
  const activePlayers = isTTTRoom ? rows.filter(r => (r.team as any).ttt_role !== 'spectator') : rows;

  const CARD = "rgba(15,15,30,0.85)";
  const rankColors = [
    { bg: "linear-gradient(135deg,#f59e0b,#d97706)", shadow: "0 0 20px rgba(245,158,11,0.5)", label: "🥇" },
    { bg: "linear-gradient(135deg,#94a3b8,#64748b)", shadow: "0 0 16px rgba(148,163,184,0.4)", label: "🥈" },
    { bg: "linear-gradient(135deg,#d97706,#92400e)", shadow: "0 0 14px rgba(217,119,6,0.4)", label: "🥉" },
  ];

  /* ── ADMIN room-select handler ── */
  const handleLoadRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomInput.trim().toUpperCase();
    if (!code) return;
    setRoom({ code, title: code, roundEndAt: null } as Room);
  };

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 50% at 50% -15%,rgba(109,40,217,0.2) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 90% 100%,rgba(6,182,212,0.08) 0%,transparent 50%),hsl(224,20%,5%)" }}>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.03) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(7,8,18,0.92)", borderBottom: "1px solid rgba(139,92,246,0.2)", backdropFilter: "blur(24px)" }}>
        <div className="h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(139,92,246,0.6),rgba(6,182,212,0.4),transparent)" }} />
        <div className="container py-3 flex items-center justify-between gap-4 flex-wrap">

          {/* Left */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-md opacity-70 animate-pulse" style={{ background: "rgba(245,158,11,0.6)" }} />
              <div className="relative w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>🏆</div>
            </div>
            <div>
              <h1 className="font-black text-xl tracking-wider" style={{ fontFamily: "'Orbitron',sans-serif", background: "linear-gradient(90deg,#fbbf24,#fde68a,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ARENA STANDINGS
              </h1>
              <p className="text-xs font-mono" style={{ color: room?.code ? "#a78bfa" : "#ef4444" }}>
                Room: <span className="font-bold">{room?.code || "NO ROOM — ENTER CODE BELOW"}</span>
              </p>
            </div>

            {/* Admin room-load form (always visible for admin) */}
            {isAdmin && (
              <form onSubmit={handleLoadRoom} className="flex gap-2 ml-2">
                <input
                  value={roomInput}
                  onChange={e => setRoomInput(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  className="rounded-lg px-3 py-1.5 text-xs font-mono font-bold tracking-wider w-28"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.4)", color: "white" }}
                />
                <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-bold text-purple-300 hover:text-white transition-colors" style={{ background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.5)" }}>
                  LOAD
                </button>
              </form>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search teams..."
              className="rounded-lg px-3 py-1.5 text-xs w-36"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.3)", color: "white" }}
            />
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    const csv = ["Rank,Team,Lines,Time,Winner"]
                      .concat(filteredRows.map(r =>
                        `${r.rank},"${r.team.team_name}",${r.team.lines_completed ?? 0},${r.team.time_taken_ms ?? 0},${(r.team.lines_completed ?? 0) >= 5 ? "Yes" : "No"}`
                      )).join("\n");
                    const b = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(b);
                    a.download = `lb-${room?.code ?? "room"}.csv`;
                    a.click();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-green-400"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  📊 CSV
                </button>
                <button
                  onClick={() => navigate("/leaderboard-all")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-cyan-400"
                  style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)" }}>
                  🌍 All Rooms
                </button>
              </>
            )}
            <button
              onClick={() => navigate(isAdmin ? "/admin" : "/game")}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 16px rgba(139,92,246,0.3)" }}>
              ← {isAdmin ? "Dashboard" : "Battle"}
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6 relative z-10">

        {/* No room prompt for admin */}
        {!room && isAdmin && (
          <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: "1px solid rgba(139,92,246,0.3)" }}>
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-lg font-black text-white mb-2" style={{ fontFamily: "'Orbitron',sans-serif" }}>SELECT A ROOM</h2>
            <p className="text-sm text-slate-500 mb-6">Enter a room code above to view its leaderboard</p>
            <form onSubmit={handleLoadRoom} className="flex gap-2 max-w-xs mx-auto">
              <input
                value={roomInput}
                onChange={e => setRoomInput(e.target.value.toUpperCase())}
                placeholder="e.g. GAME01"
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-mono font-bold tracking-wider"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.4)", color: "white" }}
              />
              <button type="submit" className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                LOAD
              </button>
            </form>
          </div>
        )}

        {/* Winner banner */}
        {hasWinner && rows.length > 0 && (() => {
          const champ = isTTTRoom
            ? rows.find(r => (r.team as any).ttt_winner)
            : rows.find(r => (r.team.lines_completed ?? 0) >= 5);
          return (
            <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.05))", border: "1px solid rgba(245,158,11,0.4)", boxShadow: "0 0 40px rgba(245,158,11,0.12)" }}>
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl animate-bounce flex-shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 0 30px rgba(245,158,11,0.6)" }}>👑</div>
                <div>
                  <p className="text-xs font-mono text-amber-400 tracking-widest mb-1">🎉 {isTTTRoom ? "TTT CHAMPION" : "ARENA CHAMPION"}</p>
                  <p className="text-xl font-black text-white" style={{ fontFamily: "'Orbitron',sans-serif" }}>{champ?.team.team_name}</p>
                  <div className="flex gap-4 mt-1 text-xs text-amber-300 font-mono">
                    <span>⏱ {formatTime(champ?.team.time_taken_ms || 0)}</span>
                    {isTTTRoom
                      ? <span>🎮 Played as {(champ?.team as any).ttt_role} · {champ?.team.solved_questions_count ?? 0} Qs solved</span>
                      : <span>📏 {champ?.team.lines_completed}/5 lines</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {!hasWinner && rows.length > 0 && (
          <div className="rounded-xl p-3 flex items-center justify-center gap-3" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
            <span className="text-lg animate-pulse">⚔️</span>
            <p className="text-xs font-mono text-indigo-300 tracking-wider">
              {isTTTRoom ? "TTT MATCH IN PROGRESS — First to get 3 in a row wins!" : "BATTLE IN PROGRESS — First to complete 5 lines wins the arena!"}
            </p>
          </div>
        )}

        {/* Stat cards */}
        {room && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "👥", label: isTTTRoom ? "PLAYERS" : "TEAMS", value: String(isTTTRoom ? activePlayers.length : rows.length), color: "rgba(139,92,246,0.35)" },
              { icon: "🏆", label: "WINNERS", value: String(rows.filter(r => isTTTRoom ? (r.team as any).ttt_winner : (r.team.lines_completed ?? 0) >= 5).length), color: "rgba(34,197,94,0.35)" },
              {
                icon: "🎯", label: isTTTRoom ? "QUESTIONS" : "AVG PROGRESS",
                value: isTTTRoom
                  ? (activePlayers.reduce((a, r) => a + (r.team.solved_questions_count ?? 0), 0) + " solved")
                  : (rows.length > 0 ? Math.round((rows.reduce((a, r) => a + (r.team.lines_completed ?? 0), 0) / rows.length) * 20) + "%" : "0%"),
                color: "rgba(245,158,11,0.35)"
              },
              {
                icon: "⚡", label: "LEADER",
                value: (isTTTRoom ? rows.find(r => (r.team as any).ttt_winner) ?? activePlayers[0] : rows[0])?.team.team_name || "--",
                color: "rgba(6,182,212,0.35)"
              },
            ].map((s, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${s.color}` }}>
                <p className="text-xs font-mono text-slate-500 tracking-widest">{s.icon} {s.label}</p>
                <p className="text-2xl font-black text-white mt-1 truncate" style={{ fontFamily: "'Orbitron',sans-serif" }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Podium — only for non-TTT or TTT with 3+ players (skip spectators) */}
        {activePlayers.length >= 3 && (
          <div className="rounded-2xl p-8" style={{ background: CARD, border: "1px solid rgba(139,92,246,0.2)" }}>
            <div className="text-center mb-6">
              <p className="text-xs font-mono text-purple-400 tracking-widest mb-1">◆ HALL OF FAME ◆</p>
              <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Orbitron',sans-serif" }}>CHAMPIONS PODIUM</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 2nd */}
              <div className="order-2 lg:order-1 rounded-2xl p-6 text-center hover:scale-105 transition-transform" style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.3)" }}>
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center text-2xl" style={{ background: "linear-gradient(135deg,#94a3b8,#64748b)", boxShadow: "0 0 16px rgba(148,163,184,0.4)" }}>🥈</div>
                <p className="text-[10px] text-slate-500 tracking-widest font-mono mb-1">2ND PLACE</p>
                <p className="font-black text-white mb-3">{rows[1]?.team.team_name}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}><span className="text-slate-500">LINES</span><span className="text-white font-bold">{rows[1]?.team.lines_completed}/5</span></div>
                  <div className="flex justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}><span className="text-slate-500">TIME</span><span className="text-white font-bold font-mono">{formatTime(rows[1]?.team.time_taken_ms || 0)}</span></div>
                </div>
              </div>
              {/* 1st */}
              <div className="order-1 lg:order-2 rounded-2xl p-8 text-center hover:scale-105 transition-transform relative" style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.05))", border: "2px solid rgba(245,158,11,0.5)", boxShadow: "0 0 40px rgba(245,158,11,0.15)" }}>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl animate-bounce">👑</div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-3xl" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 0 30px rgba(245,158,11,0.5)" }}>🥇</div>
                {(rows[0]?.team.lines_completed ?? 0) >= 5 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-300 mb-3" style={{ background: "rgba(245,158,11,0.2)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />CHAMPION
                  </div>
                )}
                <p className="text-xl font-black text-white mb-4" style={{ fontFamily: "'Orbitron',sans-serif" }}>{rows[0]?.team.team_name}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.4)" }}><p className="text-amber-400 font-black text-xl">{rows[0]?.team.lines_completed}</p><p className="text-xs text-slate-500">LINES</p></div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.4)" }}><p className="text-green-400 font-black text-sm font-mono">{formatTime(rows[0]?.team.time_taken_ms || 0)}</p><p className="text-xs text-slate-500">TIME</p></div>
                </div>
              </div>
              {/* 3rd */}
              <div className="order-3 rounded-2xl p-6 text-center hover:scale-105 transition-transform" style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.3)" }}>
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center text-2xl" style={{ background: "linear-gradient(135deg,#d97706,#92400e)", boxShadow: "0 0 14px rgba(217,119,6,0.4)" }}>🥉</div>
                <p className="text-[10px] text-slate-500 tracking-widest font-mono mb-1">3RD PLACE</p>
                <p className="font-black text-white mb-3">{rows[2]?.team.team_name}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}><span className="text-slate-500">LINES</span><span className="text-white font-bold">{rows[2]?.team.lines_completed}/5</span></div>
                  <div className="flex justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}><span className="text-slate-500">TIME</span><span className="text-white font-bold font-mono">{formatTime(rows[2]?.team.time_taken_ms || 0)}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rankings table */}
        {room && (
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: "1px solid rgba(139,92,246,0.2)" }}>
            <div className="px-6 py-4" style={{ background: "linear-gradient(135deg,rgba(109,40,217,0.5),rgba(99,102,241,0.35),rgba(6,182,212,0.2))", borderBottom: "1px solid rgba(139,92,246,0.3)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-white" style={{ fontFamily: "'Orbitron',sans-serif" }}>📊 COMPLETE RANKINGS</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-purple-300">{filteredRows.length} TEAMS</span>
                  {/* Pulsing live indicator */}
                  <span className="flex items-center gap-1.5 text-xs text-green-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" style={{ animationDuration: "2s" }} />
                    LIVE
                  </span>
                </div>
              </div>
            </div>

            <div>
              {filteredRows.map((r, index) => {
                const tttRole = (r.team as any).ttt_role as 'X' | 'O' | 'spectator' | null;
                const tttWinner = (r.team as any).ttt_winner as boolean;
                const tttDraw = (r.team as any).ttt_draw as boolean;
                const isSpectator = isTTTRoom && tttRole === 'spectator';
                const isWinner = isTTTRoom ? tttWinner : (r.team.lines_completed ?? 0) >= 5;
                const isMe = team && r.team.id === team.id;
                const pct = Math.min(((r.team.lines_completed ?? 0) / 5) * 100, 100);
                const effectiveIndex = isSpectator ? 99 : index;
                const rStyle = rankColors[effectiveIndex] ?? { bg: "rgba(99,102,241,0.25)", shadow: "none", label: `#${r.rank}` };
                const anyWinner = isTTTRoom && rows.some(x => (x.team as any).ttt_winner);
                const tttStatus = isTTTRoom
                  ? (isSpectator ? "SPECTATOR" : tttWinner ? "WIN ✓" : tttDraw ? "DRAW" : anyWinner ? "LOSS" : "PLAYING")
                  : null;
                return (
                  <div key={`${r.rank}-${r.team.id}`}
                    className="px-5 py-3.5 flex items-center gap-4 transition-colors duration-150"
                    style={{
                      borderBottom: "1px solid rgba(139,92,246,0.08)",
                      background: isMe ? "rgba(139,92,246,0.09)" : isSpectator ? "rgba(0,0,0,0.15)" : "transparent",
                      borderLeft: isMe ? "3px solid rgba(139,92,246,0.7)" : isSpectator ? "3px solid rgba(100,116,139,0.3)" : "3px solid transparent",
                      opacity: isSpectator ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { if (!isMe && !isSpectator) e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isMe ? "rgba(139,92,246,0.09)" : isSpectator ? "rgba(0,0,0,0.15)" : "transparent"; }}>

                    {/* Rank badge */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white flex-shrink-0"
                      style={{ fontSize: isSpectator || effectiveIndex >= 3 ? "11px" : "16px", background: isSpectator ? "rgba(100,116,139,0.25)" : effectiveIndex < 3 ? rStyle.bg : "rgba(99,102,241,0.2)", boxShadow: isSpectator ? "none" : effectiveIndex < 3 ? rStyle.shadow : "none" }}>
                      {isSpectator ? "👁" : effectiveIndex < 3 ? rStyle.label : `#${r.rank}`}
                    </div>

                    {/* Name + tags + progress */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{r.team.team_name}</span>
                        {isMe && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-purple-300" style={{ background: "rgba(139,92,246,0.25)" }}>YOU</span>}
                        {isTTTRoom && tttRole && tttRole !== 'spectator' && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: tttRole === 'X' ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)", color: tttRole === 'X' ? "#fca5a5" : "#93c5fd", border: `1px solid ${tttRole === 'X' ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)"}` }}>PLAYER {tttRole}</span>
                        )}
                        {isSpectator && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-slate-400" style={{ background: "rgba(100,116,139,0.15)", border: "1px solid rgba(100,116,139,0.3)" }}>👁 SPECTATOR</span>}
                        {isWinner && !isSpectator && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-amber-300" style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.3)" }}>🏆 WIN</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {isTTTRoom ? (
                          <span className="text-[10px] font-mono" style={{ color: tttStatus === "WIN ✓" ? "#4ade80" : tttStatus === "LOSS" ? "#f87171" : tttStatus === "DRAW" ? "#fbbf24" : tttStatus === "SPECTATOR" ? "#374151" : "#a5b4fc" }}>
                            {tttStatus}{!isSpectator && ` · ${r.team.solved_questions_count ?? 0} questions solved`}
                          </span>
                        ) : (
                          <>
                            <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: isWinner ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#7c3aed,#a855f7)" }} />
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 flex-shrink-0">{r.team.lines_completed ?? 0}/5</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Time */}
                    <div className="text-right hidden sm:block flex-shrink-0">
                      <p className="font-mono text-sm font-bold" style={{ color: isSpectator ? "#374151" : "white" }}>
                        {isSpectator ? "—" : r.team.start_time ? formatTime(r.team.time_taken_ms || 0) : "—"}
                      </p>
                      <p className="text-[10px] text-slate-600">{isSpectator ? "WATCHING" : r.team.end_time ? "DONE" : r.team.start_time ? "LIVE" : "WAIT"}</p>
                    </div>

                    {/* Status chip */}
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono"
                      style={{
                        background: isSpectator ? "rgba(0,0,0,0.1)" : isWinner ? "rgba(34,197,94,0.15)" : tttDraw ? "rgba(251,191,36,0.1)" : "rgba(99,102,241,0.12)",
                        color: isSpectator ? "#374151" : isWinner ? "#4ade80" : tttDraw ? "#fbbf24" : "#a5b4fc",
                        border: `1px solid ${isSpectator ? "rgba(0,0,0,0.05)" : isWinner ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.25)"}`,
                      }}>
                      {isSpectator ? "WATCH" : isTTTRoom ? tttStatus?.replace(" ✓", "") ?? "LIVE" : isWinner ? "DONE" : (r.team.lines_completed ?? 0) > 0 ? "LIVE" : "IDLE"}
                    </span>
                  </div>
                );
              })}

              {rows.length === 0 && room && (
                <div className="py-16 text-center">
                  <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="font-mono text-slate-500 tracking-widest text-xs">LOADING BATTLE DATA...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

