import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { LeaderboardResponse, Room, GameStateResponse, Team } from "@shared/api";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin =
    typeof window !== "undefined" &&
    localStorage.getItem("bingo.admin") === "true";
  const fromCongratulations = location.state?.fromCongratulations || false;
  const [team, setTeam] = useState<Team | null>(() => {
    const raw = localStorage.getItem("bingo.team");
    try {
      return raw && raw !== "undefined" && raw !== "null"
        ? (JSON.parse(raw) as Team)
        : null;
    } catch {
      return null;
    }
  });
  const [room, setRoom] = useState<Room | null>(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("room");
    if (fromQuery)
      return {
        code: fromQuery.toUpperCase(),
        title: fromQuery.toUpperCase(),
        roundEndAt: null,
      } as Room;
    const raw = localStorage.getItem("bingo.room");
    try {
      return raw && raw !== "undefined" && raw !== "null"
        ? (JSON.parse(raw) as Room)
        : null;
    } catch {
      return null;
    }
  });
  const [rows, setRows] = useState<LeaderboardResponse["rows"]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);

  const load = async () => {
    if (!room) return;
    const res = await fetch(
      `/api/leaderboard?room=${encodeURIComponent(room.code)}`,
    );
    const data = (await res.json()) as LeaderboardResponse;
    setRows(data.rows);

    // Check game completion if from congratulations and team exists
    if (fromCongratulations && team) {
      const stateRes = await fetch(
        `/api/game-state?teamId=${encodeURIComponent(team.team_id)}`,
      );
      const state = (await stateRes.json()) as GameStateResponse;
      setGameCompleted(state.team.lines_completed >= 5);
    }
  };

  useEffect(() => {
    if (!room && !isAdmin) navigate("/");
  }, [room, isAdmin, navigate]);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <header className="sticky top-0 bg-white/80 backdrop-blur border-b">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-bold text-slate-800">Live Leaderboard</h1>
              <p className="text-sm text-slate-500">
                Room: {room?.code ?? "—"}
              </p>
            </div>
            {isAdmin && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget as HTMLFormElement;
                  const input = form.elements.namedItem(
                    "code",
                  ) as HTMLInputElement;
                  const code = input.value.trim().toUpperCase();
                  if (!code) return;
                  setLoading(prev => ({ ...prev, loadRoom: true }));
                  try {
                    setRoom({ code, title: code, roundEndAt: null } as Room);
                    setRows([]);
                  } finally {
                    setLoading(prev => ({ ...prev, loadRoom: false }));
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  name="code"
                  defaultValue={room?.code ?? ""}
                  className="rounded-lg border px-2 py-1 text-sm"
                />
                <button
                  disabled={loading.loadRoom}
                  className="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-blue-50 disabled:opacity-60 flex items-center gap-2"
                >
                  {loading.loadRoom && (
                    <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                  )}
                  Load
                </button>
              </form>
            )}
          </div>
          <a
            href={isAdmin ? "/admin" : "/game"}
            className={`px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 ${
              fromCongratulations && gameCompleted ? "hidden" : ""
            }`}
          >
            {isAdmin ? "Back to Dashboard" : "Back to Game"}
          </a>
        </div>
      </header>

      <main className="container py-6">
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-4 gap-0 border-b bg-blue-50 text-blue-900 font-semibold text-sm">
            <div className="px-4 py-3">Rank</div>
            <div className="px-4 py-3">Team Name</div>
            <div className="px-4 py-3">Lines Completed</div>
            <div className="px-4 py-3">Time Taken</div>
          </div>
          {rows.map((r) => (
            <div
              key={r.rank}
              className="grid grid-cols-4 gap-0 border-b last:border-b-0"
            >
              <div className="px-4 py-3 font-semibold">#{r.rank}</div>
              <div className="px-4 py-3">{r.team_name}</div>
              <div className="px-4 py-3">{r.lines_completed}</div>
              <div className="px-4 py-3">{formatTime(r.time_taken_ms)}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function formatTime(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
