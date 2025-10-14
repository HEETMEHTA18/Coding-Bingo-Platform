import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LeaderboardResponse, Room } from "@shared/api";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(() => {
    const raw = localStorage.getItem("bingo.room");
    try {
      return raw && raw !== "undefined" && raw !== "null" ? (JSON.parse(raw) as Room) : null;
    } catch {
      return null;
    }
  });
  const [rows, setRows] = useState<LeaderboardResponse["rows"]>([]);

  const load = async () => {
    if (!room) return;
    const res = await fetch(`/api/leaderboard?room=${encodeURIComponent(room.code)}`);
    const data = (await res.json()) as LeaderboardResponse;
    setRows(data.rows);
  };

  useEffect(() => {
    if (!room) navigate("/");
  }, [room, navigate]);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <header className="sticky top-0 bg-white/80 backdrop-blur border-b">
        <div className="container py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800">Live Leaderboard</h1>
            <p className="text-sm text-slate-500">Room: {room?.code}</p>
          </div>
          <a href="/game" className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Back to Game</a>
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
            <div key={r.rank} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
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
