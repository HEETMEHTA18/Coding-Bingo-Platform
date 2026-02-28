/**
 * SpectateView – admin-only live spectator view for any TicTacToe game.
 * URL: /spectate?room=ROOMCODE
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// ── tiny helpers ──────────────────────────────────────────────────────────────
function fmt(ms: number) {
  if (!ms || ms <= 0) return "—";
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── types ─────────────────────────────────────────────────────────────────────
interface SpectateState {
  exists: boolean;
  roomCode: string;
  gameType: string;
  roundEndAt: string | null;
  board: (string | null)[];
  turn: string;
  teamX: string | null;
  teamO: string | null;
  teamXName: string | null;
  teamOName: string | null;
  movesCredits: Record<string, number>;
  knivesCredits: Record<string, number>;
  winner: string | null;
  winnerName: string | null;
  winByMajority?: boolean;
  bothConnected: boolean;
  bonusQuestion: { text: string; isReal: boolean } | null;
}

// ── X / O SVG icons ──────────────────────────────────────────────────────────
function XIcon({ size = 56, color = "#3b82f6" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <line x1="10" y1="10" x2="46" y2="46" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <line x1="46" y1="10" x2="10" y2="46" stroke={color} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
function OIcon({ size = 56, color = "#ef4444" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="18" stroke={color} strokeWidth="7" />
    </svg>
  );
}

// ── Team card ─────────────────────────────────────────────────────────────────
function TeamCard({
  name, symbol, teamId, movesCredits, knivesCredits, isTurn, isWinner,
}: {
  name: string | null;
  symbol: "X" | "O";
  teamId: string | null;
  movesCredits: Record<string, number>;
  knivesCredits: Record<string, number>;
  isTurn: boolean;
  isWinner: boolean;
}) {
  const moves = teamId ? (movesCredits[teamId] ?? 0) : 0;
  const knives = teamId ? (knivesCredits[teamId] ?? 0) : 0;
  const isX = symbol === "X";
  const accent = isX ? { border: "rgba(59,130,246,0.5)", bg: "rgba(59,130,246,0.08)", glow: "rgba(59,130,246,0.35)", text: "#93c5fd" }
    : { border: "rgba(239,68,68,0.5)", bg: "rgba(239,68,68,0.08)", glow: "rgba(239,68,68,0.35)", text: "#fca5a5" };

  return (
    <div
      className="flex-1 rounded-2xl p-5 transition-all duration-300"
      style={{
        background: accent.bg,
        border: `1.5px solid ${isTurn ? accent.border : "rgba(100,116,139,0.2)"}`,
        boxShadow: isTurn ? `0 0 24px ${accent.glow}` : "none",
      }}
    >
      {/* Symbol + name */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: isX ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)" }}
        >
          {isX ? <XIcon size={28} /> : <OIcon size={28} />}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5"
            style={{ color: accent.text }}>TEAM {symbol}</p>
          <p className="font-black text-white text-sm truncate leading-tight">
            {name ?? <span className="text-slate-500 italic font-normal text-xs">Waiting…</span>}
          </p>
        </div>
        {isWinner && (
          <div className="ml-auto shrink-0 text-xl animate-bounce">👑</div>
        )}
        {isTurn && !isWinner && (
          <div className="ml-auto shrink-0 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse"
            style={{ background: isX ? "rgba(59,130,246,0.2)" : "rgba(239,68,68,0.2)", color: accent.text }}>
            TURN
          </div>
        )}
      </div>

      {/* Credits */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <p className="font-black text-2xl text-blue-400">{moves}</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">⚔ Moves</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p className="font-black text-2xl text-red-400">{knives}</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">🔪 Knives</p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SpectateView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roomCode = (params.get("room") || "").toUpperCase();

  const [state, setState] = useState<SpectateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [countdown, setCountdown] = useState<string>("—");
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch spectate state ────────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    if (!roomCode) return;
    try {
      const res = await fetch(`/api/spectate?room=${encodeURIComponent(roomCode)}`);
      if (!res.ok) return;
      const data = await res.json();
      setState(data);
      setLastUpdate(Date.now());
    } catch { /* silent */ }
    setLoading(false);
  }, [roomCode]);

  // ── SSE for real-time pushes + polling fallback ─────────────────────────────
  useEffect(() => {
    if (!roomCode) { setLoading(false); return; }

    fetchState();

    // SSE (live push from server on board changes)
    const es = new EventSource(`/api/tictactoe/stream?room=${encodeURIComponent(roomCode)}`);
    sseRef.current = es;
    es.onmessage = () => fetchState(); // any push → refetch full state

    // Polling fallback every 2 s (ensures we don't miss anything)
    pollRef.current = setInterval(fetchState, 2000);

    return () => {
      es.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [roomCode, fetchState]);

  // ── Room timer countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (!state?.roundEndAt) { setCountdown("—"); return; }
    const tick = () => {
      const diff = new Date(state.roundEndAt!).getTime() - Date.now();
      if (diff <= 0) { setCountdown("ENDED"); return; }
      setCountdown(fmt(diff));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [state?.roundEndAt]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const cellsAgo = Math.floor((Date.now() - lastUpdate) / 1000);

  if (!roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(224,20%,5%)" }}>
        <div className="text-center">
          <p className="text-3xl mb-4">🔍</p>
          <p className="text-white font-bold text-lg mb-2">No room specified</p>
          <p className="text-slate-500 text-sm mb-6">Use <code className="text-purple-400">/spectate?room=ROOMCODE</code></p>
          <button onClick={() => navigate("/leaderboard-all")} className="px-5 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.5)" }}>
            ← Back to All Arenas
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(224,20%,5%)" }}>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-mono tracking-widest text-xs animate-pulse">CONNECTING TO ARENA…</p>
        </div>
      </div>
    );
  }

  if (!state?.exists) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(224,20%,5%)" }}>
        <div className="text-center">
          <p className="text-4xl mb-4">🌌</p>
          <p className="text-white font-bold text-xl mb-2">Arena not found</p>
          <p className="text-slate-500 text-sm mb-6">Room <span className="text-purple-400 font-mono">{roomCode}</span> has no active TicTacToe board yet.</p>
          <button onClick={() => navigate("/leaderboard-all")} className="px-5 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.5)" }}>
            ← All Arenas
          </button>
        </div>
      </div>
    );
  }

  const board = state.board ?? Array(9).fill(null);
  const hasWinner = !!state.winner;

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,40,217,0.2) 0%, transparent 55%), hsl(224,20%,5%)" }}
    >
      {/* BG grid */}
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: "linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50"
        style={{ background: "rgba(7,8,18,0.93)", borderBottom: "1px solid rgba(139,92,246,0.2)", backdropFilter: "blur(24px)" }}>
        <div className="h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(139,92,246,0.6),rgba(6,182,212,0.4),transparent)" }} />
        <div className="container py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-md opacity-60 animate-pulse" style={{ background: "rgba(139,92,246,0.7)" }} />
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>👁</div>
            </div>
            {/* Title */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg tracking-wider"
                  style={{ fontFamily: "'Orbitron',sans-serif", background: "linear-gradient(90deg,#c4b5fd,#f0abfc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  SPECTATING
                </h1>
                <span className="font-mono text-base font-bold text-white">{roomCode}</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5" }}>
                  ● LIVE
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500">
                <span className="text-cyan-400">{state.gameType?.toUpperCase() || "GAME"}</span>
                &nbsp;·&nbsp;⏱ {countdown}
                &nbsp;·&nbsp;<span className="text-slate-600">updated {cellsAgo}s ago</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${state.bothConnected ? "text-green-400" : "text-yellow-400"}`}
              style={{ background: state.bothConnected ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)", border: `1px solid ${state.bothConnected ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}` }}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${state.bothConnected ? "bg-green-400" : "bg-yellow-400"}`} />
              {state.bothConnected ? "BOTH CONNECTED" : "WAITING FOR PLAYERS"}
            </div>
            <button onClick={() => navigate("/leaderboard-all")}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 16px rgba(139,92,246,0.3)" }}>
              ← All Arenas
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 relative z-10 max-w-5xl">

        {/* ── Bonus question banner ── */}
        {state.bonusQuestion && (
          <div className="mb-6 rounded-2xl overflow-hidden border-2 border-yellow-500/60 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
            style={{ background: "linear-gradient(135deg,#1a1500,#0f0f00)" }}>
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-yellow-500/20">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping" style={{ animationDuration: "0.8s" }} />
              <span className="text-yellow-400 font-black text-xs uppercase tracking-widest">⚡ LIVE BONUS CHALLENGE ACTIVE</span>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${state.bonusQuestion.isReal ? "bg-blue-600/20 border-blue-500/40 text-blue-400" : "bg-red-600/20 border-red-500/40 text-red-400"}`}>
                {state.bonusQuestion.isReal ? "⚔️ +2 MOVE CREDITS" : "🔪 +2 KNIFE CREDITS"}
              </span>
            </div>
            <p className="px-5 py-3 text-sm font-mono text-white/90 leading-relaxed">{state.bonusQuestion.text}</p>
          </div>
        )}

        {/* ── Winner overlay card ── */}
        {hasWinner && (() => {
          const xCells = board.filter(c => c === 'X').length;
          const oCells = board.filter(c => c === 'O').length;
          return (
            <div className="mb-6 rounded-2xl p-6 text-center border-2"
              style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(0,0,0,0.4))", borderColor: "rgba(245,158,11,0.5)", boxShadow: "0 0 40px rgba(245,158,11,0.15)" }}>
              <div className="text-5xl mb-3 animate-bounce">👑</div>
              <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-1">ARENA CHAMPION</p>
              <h2 className="text-3xl font-black text-amber-300 mb-1" style={{ fontFamily: "'Orbitron',sans-serif" }}>{state.winnerName ?? state.winner}</h2>
              {state.winByMajority ? (
                <p className="text-slate-400 text-xs font-mono">
                  Won by cell majority &nbsp;·&nbsp;
                  <span className="text-blue-400">✕ {xCells} cells</span>
                  &nbsp;vs&nbsp;
                  <span className="text-red-400">○ {oCells} cells</span>
                </p>
              ) : (
                <p className="text-slate-500 text-xs font-mono">Dominated the arena with 3-in-a-row</p>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">

          {/* ── Team X card ── */}
          <TeamCard
            name={state.teamXName}
            symbol="X"
            teamId={state.teamX}
            movesCredits={state.movesCredits}
            knivesCredits={state.knivesCredits}
            isTurn={state.turn === "X"}
            isWinner={state.winner === state.teamX}
          />

          {/* ── Board ── */}
          <div className="flex flex-col items-center gap-5">
            {/* Turn indicator */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(139,92,246,0.3)" }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: state.turn === "X" ? "#3b82f6" : "#ef4444" }} />
              <span className="text-slate-400">Turn:</span>
              <span style={{ color: state.turn === "X" ? "#93c5fd" : "#fca5a5" }} className="font-black">
                {state.turn === "X" ? (state.teamXName ?? "Team X") : (state.teamOName ?? "Team O")}
              </span>
            </div>

            {/* 3×3 grid */}
            <div className="grid grid-cols-3 gap-3 p-5 rounded-[2rem] border-4"
              style={{ background: "rgba(15,15,26,0.8)", borderColor: "rgba(71,85,105,0.5)", boxShadow: "0 0 60px rgba(0,0,0,0.6)" }}>
              {board.map((cell, i) => (
                <div
                  key={i}
                  className="w-28 h-28 flex items-center justify-center rounded-2xl transition-all duration-300"
                  style={{
                    background: cell === "X"
                      ? "rgba(59,130,246,0.08)"
                      : cell === "O"
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(10,10,20,1)",
                    border: cell === "X"
                      ? "2px solid rgba(59,130,246,0.4)"
                      : cell === "O"
                        ? "2px solid rgba(239,68,68,0.4)"
                        : "2px solid rgba(71,85,105,0.5)",
                    boxShadow: cell === "X"
                      ? "0 0 20px rgba(59,130,246,0.15)"
                      : cell === "O"
                        ? "0 0 20px rgba(239,68,68,0.15)"
                        : "none",
                  }}
                >
                  {cell === "X" && <XIcon size={52} />}
                  {cell === "O" && <OIcon size={52} />}
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="w-full max-w-[24rem] text-center">
              <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(board.filter(c => c).length / 9) * 100}%`,
                    background: hasWinner ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#7c3aed,#a855f7)",
                  }}
                />
              </div>
              <p className="text-[10px] font-mono text-slate-600">
                {board.filter(c => c).length} / 9 cells filled
                {hasWinner && <span className="text-green-400 ml-2 font-bold">· GAME OVER</span>}
              </p>
            </div>
          </div>

          {/* ── Team O card ── */}
          <TeamCard
            name={state.teamOName}
            symbol="O"
            teamId={state.teamO}
            movesCredits={state.movesCredits}
            knivesCredits={state.knivesCredits}
            isTurn={state.turn === "O"}
            isWinner={state.winner === state.teamO}
          />
        </div>

        {/* ── Refresh note ── */}
        <p className="text-center text-[10px] text-slate-700 font-mono mt-8">
          Auto-refreshing every 2 s via SSE stream · Read-only view
        </p>
      </main>
    </div>
  );
}
