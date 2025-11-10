// Code Race (Debug) Game - Coming Soon
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GameHeader from "../../components/GameHeader";
import type { Team, Room } from "@shared/api";

function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    if (raw === "undefined" || raw === "null") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function RaceGame() {
  const navigate = useNavigate();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  useEffect(() => {
    if (!team || !room) navigate("/");
  }, [team, room, navigate]);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <GameHeader
        gameTitle="Code Race (Debug)"
        gameIcon="🏁"
        team={team}
        room={room}
        showAchievements={false}
        showLeaderboard={false}
      />

      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-8 sm:p-12 text-center max-w-2xl shadow-2xl">
          <div className="text-6xl sm:text-8xl mb-6">🏁</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">Code Race (Debug)</h1>
          <div className="space-y-4 mb-8">
            <p className="text-lg sm:text-xl text-slate-300">
              🚧 This game is under development! 🚧
            </p>
            <p className="text-base sm:text-lg text-slate-400">
              Find and fix bugs faster than other teams!
            </p>
            <div className="bg-slate-800/50 rounded-lg p-4 mt-4">
              <p className="text-sm text-slate-400">
                <strong className="text-red-400">Coming Features:</strong>
              </p>
              <ul className="text-sm text-slate-400 mt-2 space-y-1">
                <li>• Real-time race against other teams</li>
                <li>• Debug broken code snippets</li>
                <li>• Speed-based scoring system</li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold text-lg shadow-xl transform hover:scale-105 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
