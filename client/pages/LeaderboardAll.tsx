import { useEffect, useState } from "react";
import type { LeaderboardAllResponse } from "@shared/api";

export default function LeaderboardAllPage() {
  const [rows, setRows] = useState<LeaderboardAllResponse["rows"]>([]);

  const load = async () => {
    const res = await fetch("/api/leaderboard-all");
    if (!res.ok) return;
    const data = (await res.json()) as LeaderboardAllResponse;
    setRows(data.rows);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <header className="sticky top-0 bg-white/80 backdrop-blur border-b">
        <div className="container py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800">All Rooms Leaderboard</h1>
            <p className="text-sm text-slate-500">
              Aggregated across all rooms
            </p>
          </div>
          <a
            href="/admin"
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
          >
            Back to Dashboard
          </a>
        </div>
      </header>

      <main className="container py-6">
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-5 gap-0 border-b bg-blue-50 text-blue-900 font-semibold text-sm">
            <div className="px-4 py-3">Rank</div>
            <div className="px-4 py-3">Team Name</div>
            <div className="px-4 py-3">Room</div>
            <div className="px-4 py-3">Lines Completed</div>
            <div className="px-4 py-3">Time Taken</div>
          </div>
          {rows.map((r) => (
            <div
              key={`${r.room_code}-${r.rank}`}
              className="grid grid-cols-5 gap-0 border-b last:border-b-0"
            >
              <div className="px-4 py-3 font-semibold">#{r.rank}</div>
              <div className="px-4 py-3">{r.team_name}</div>
              <div className="px-4 py-3">{r.room_code}</div>
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
