import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameStateResponse, LeaderboardResponse, Team } from "@shared/api";
import { apiFetch } from "../lib/api";

export default function CongratulationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    const rawTeam = localStorage.getItem("bingo.team");
    const rawRoom = localStorage.getItem("bingo.room");
    let t: Team | null = null;
    let room: { code: string } | null = null;
    try {
      t =
        rawTeam && rawTeam !== "undefined" && rawTeam !== "null"
          ? (JSON.parse(rawTeam) as Team)
          : null;
      room =
        rawRoom && rawRoom !== "undefined" && rawRoom !== "null"
          ? (JSON.parse(rawRoom) as { code: string })
          : null;
    } catch {}
    if (!t || !room) {
      navigate("/");
      return;
    }
    setTeam(t);

    const run = async () => {
      const stateRes = await apiFetch(
        `/api/game-state?teamId=${encodeURIComponent(t.team_id)}`,
      );
      const state = (await stateRes.json()) as GameStateResponse;
      if (state.team.lines_completed < 5) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      setAllowed(true);
      const lbRes = await apiFetch(
        `/api/leaderboard?room=${encodeURIComponent(room.code)}`,
      );
      const lb = (await lbRes.json()) as LeaderboardResponse;
      const my = lb.rows.find((r) => r.team.team_name === t.name);
      setRank(my?.rank ?? null);
      setLoading(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 dark:text-slate-400 mt-4">Loading...</p>
        </div>
      </div>
    );

  if (!allowed)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">Access Denied</p>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Complete 5 lines to view this page
          </p>
          <a
            href="/game"
            className="inline-block mt-4 text-primary font-semibold"
          >
            Back to Game
          </a>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-xl p-8 w-full max-w-lg text-center">
        <div className="text-4xl">🎉</div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">
          Congratulations!
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">You Completed Bingo!</p>
        <div className="mt-4">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Team: {team?.team_name}
          </p>
          {rank && (
            <p className="text-blue-700 dark:text-blue-400 font-medium mt-1">Rank: #{rank}</p>
          )}
        </div>
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() =>
              navigate("/leaderboard", { state: { fromCongratulations: true } })
            }
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
          >
            View Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
