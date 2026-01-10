import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type {
  LeaderboardResponse,
  Room,
  GameStateResponse,
  Team,
} from "@shared/api";
import { apiFetch } from "../lib/api";

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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);

  const load = async () => {
    if (!room) return;
    const res = await apiFetch(
      `/api/leaderboard?room=${encodeURIComponent(room.code)}`,
    );
    const data = (await res.json()) as LeaderboardResponse;
    setRows(data.rows);

    // Check game completion if from congratulations and team exists
    if (fromCongratulations && team) {
      const stateRes = await apiFetch(
        `/api/game-state?teamId=${encodeURIComponent(team.id)}`,
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
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code]);

  // Find the maximum lines completed among all teams
  const maxLinesCompleted = Math.max(
    ...rows.map((r) => r.team.lines_completed ?? 0),
  );

  // A team is a winner only if they have completed bingo (>= 5 lines)
  const hasWinner = rows.some((r) => (r.team.lines_completed ?? 0) >= 5);

  const filteredRows = rows.filter((r) =>
    r.team.team_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-b border-white/20 dark:border-slate-700/50 shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
              <span className="text-2xl">🏆</span>
            </div>
            <div>
              <h1 className="font-bold text-2xl text-slate-800 dark:text-slate-200">
                Live Leaderboard
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Room:{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {room?.code ?? "—"}
                </span>
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
                  setLoading((prev) => ({ ...prev, loadRoom: true }));
                  try {
                    setRoom({ code, title: code, roundEndAt: null } as Room);
                    setRows([]);
                  } finally {
                    setLoading((prev) => ({ ...prev, loadRoom: false }));
                  }
                }}
                className="flex items-center gap-2 ml-4"
              >
                <input
                  name="code"
                  defaultValue={room?.code ?? ""}
                  placeholder="Room Code"
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                />
                <button
                  disabled={loading.loadRoom}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-60 flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {loading.loadRoom && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  Load
                </button>
              </form>
            )}
          </div>
          <div className="flex items-center gap-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams..."
              className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            />
            {isAdmin && (
              <button
                onClick={() => {
                  const csvContent = [
                    [
                      "Rank",
                      "Team Name",
                      "Lines Completed",
                      "Time Taken (ms)",
                      "Winner",
                      "Completion Time",
                    ].join(","),
                    ...filteredRows.map((r) =>
                      [
                        r.rank,
                        `"${r.team.team_name}"`,
                        r.team.lines_completed ?? 0,
                        r.team.time_taken_ms ?? 0,
                        (r.team.lines_completed ?? 0) === maxLinesCompleted &&
                        maxLinesCompleted > 0
                          ? "Yes"
                          : "No",
                        r.team.end_time
                          ? `"${new Date(r.team.end_time).toISOString()}"`
                          : "",
                      ].join(","),
                    ),
                  ].join("\n");
                  const blob = new Blob([csvContent], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const link = document.createElement("a");
                  const url = URL.createObjectURL(blob);
                  link.setAttribute("href", url);
                  link.setAttribute(
                    "download",
                    `leaderboard-${room?.code || "room"}.csv`,
                  );
                  link.style.visibility = "hidden";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                📊 Export CSV
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate("/leaderboard-all")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                🌍 All Rooms
              </button>
            )}
            <button
              onClick={() => navigate(isAdmin ? "/admin" : "/game")}
              className={`px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-teal-500 text-white font-semibold hover:from-green-600 hover:to-teal-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${fromCongratulations && gameCompleted ? "hidden" : ""}`}
            >
              {isAdmin ? "Back to Dashboard" : "Back to Game"}
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="space-y-8">
          {/* Room Winner Banner */}
          {hasWinner && rows.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-100 via-amber-100 to-orange-100 dark:from-yellow-900/30 dark:via-amber-900/30 dark:to-orange-900/30 border-2 border-yellow-300 dark:border-yellow-600 rounded-2xl p-6 shadow-2xl animate-in slide-in-from-top-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-xl animate-bounce">
                    <span className="text-4xl">👑</span>
                  </div>
                  <div>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 font-semibold uppercase tracking-wider">
                      🎉 Room Winner
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {rows.find(r => (r.team.lines_completed ?? 0) >= 5)?.team.team_name}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-600 dark:text-slate-400">
                      <span>⏱️ {formatTime(rows.find(r => (r.team.lines_completed ?? 0) >= 5)?.team.time_taken_ms || 0)}</span>
                      <span>📏 {rows.find(r => (r.team.lines_completed ?? 0) >= 5)?.team.lines_completed}/5 lines</span>
                      <span>✅ {rows.find(r => (r.team.lines_completed ?? 0) >= 5)?.team.solved_questions_count || 0} questions solved</span>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block">
                  <div className="text-6xl animate-pulse">🏆</div>
                </div>
              </div>
            </div>
          )}

          {/* No Winner Yet Banner */}
          {!hasWinner && rows.length > 0 && (
            <div className="bg-gradient-to-r from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 border border-blue-300 dark:border-blue-600 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl animate-pulse">⏳</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  No winner yet! First team to complete 5 lines wins 🎯
                </span>
              </div>
            </div>
          )}

          {/* Dashboard Header with Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Total Teams
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {rows.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🏆</span>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Winners
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {
                      rows.filter(
                        (r) =>
                          (r.team.lines_completed ?? 0) >= 5 &&
                          !!r.team.end_time,
                      ).length
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🎯</span>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Avg Progress
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {rows.length > 0
                      ? Math.round(
                          (rows.reduce(
                            (acc, r) => acc + (r.team.lines_completed ?? 0),
                            0,
                          ) /
                            rows.length) *
                            20,
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🏆</span>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Current Leader
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {rows.length > 0 ? rows[0]?.team.team_name : "--"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {rows.length > 0 ? `${rows[0]?.team.lines_completed} lines` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top 3 Champions Dashboard */}
          {rows.length >= 3 && (
            <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-800/50 dark:via-slate-800 dark:to-slate-800/50 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-3xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold shadow-lg mb-4">
                  <span className="text-2xl">🏆</span>
                  <span>Champions Dashboard</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Top Performers
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-lg">
                  Celebrating excellence and achievement
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 2nd Place */}
                <div className="order-2 lg:order-1 transform hover:scale-105 transition-all duration-500">
                  <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-600 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-slate-300/20 to-transparent rounded-bl-full"></div>
                    <div className="text-center relative z-10">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg">
                        <span className="text-2xl">🥈</span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-semibold">
                        2ND PLACE
                      </div>
                      <div className="font-bold text-xl text-slate-800 dark:text-slate-200 mb-4">
                        {rows[1]?.team.team_name}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 rounded-xl p-3">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Lines Completed
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {rows[1]?.team.lines_completed} lines
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 rounded-xl p-3">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Time Taken
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {formatTime(rows[1]?.team.time_taken_ms || 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 rounded-xl p-3">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Rank
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            #{rows[1]?.rank}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1st Place - Hero Section */}
                <div className="order-1 lg:order-2 transform hover:scale-105 transition-all duration-500">
                  <div className="bg-gradient-to-br from-yellow-100 via-yellow-50 to-amber-100 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-yellow-900/20 rounded-3xl p-10 shadow-2xl border-2 border-yellow-300 dark:border-yellow-600 relative overflow-hidden">
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-xl animate-bounce">
                        <span className="text-3xl">👑</span>
                      </div>
                    </div>

                    <div className="text-center pt-6 relative z-10">
                      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl animate-pulse">
                        <span className="text-4xl">🥇</span>
                      </div>

                      {(rows[0]?.team.lines_completed ?? 0) >= 5 &&
                        rows[0]?.team.end_time && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-200 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 text-sm font-bold mb-4 shadow-lg">
                            <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
                            CHAMPION
                          </div>
                        )}

                      <div className="font-bold text-3xl text-slate-800 dark:text-slate-200 mb-6">
                        {rows[0]?.team.team_name}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-4 shadow-lg">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                            {rows[0]?.team.lines_completed}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Lines
                          </div>
                        </div>
                        <div className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-4 shadow-lg">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                            {formatTime(rows[0]?.team.time_taken_ms || 0)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Time
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3rd Place */}
                <div className="order-3 lg:order-3 transform hover:scale-105 transition-all duration-500">
                  <div className="bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-3xl p-8 shadow-xl border border-amber-200 dark:border-amber-600 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-300/20 to-transparent rounded-bl-full"></div>
                    <div className="text-center relative z-10">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                        <span className="text-2xl">🥉</span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-semibold">
                        3RD PLACE
                      </div>
                      <div className="font-bold text-xl text-slate-800 dark:text-slate-200 mb-4">
                        {rows[2]?.team.team_name}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 rounded-xl p-3">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Lines Completed
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {rows[2]?.team.lines_completed} lines
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 rounded-xl p-3">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Time Taken
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {formatTime(rows[2]?.team.time_taken_ms || 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 rounded-xl p-3">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Rank
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            #{rows[2]?.rank}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Leaderboard */}
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white flex items-center gap-4 mb-2">
                    <span className="text-4xl">📊</span>
                    Complete Rankings
                  </h2>
                  <p className="text-blue-100 text-lg">
                    Full leaderboard standings and progress tracking
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {filteredRows.length}
                  </div>
                  <div className="text-blue-200">Active Teams</div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredRows.map((r, index) => {
                const isTopThree = index < 3;
                // Winner if the team has completed bingo (5 or more lines)
                const isWinner = (r.team.lines_completed ?? 0) >= 5;
                const isCurrentUser = team && r.team.id === team.id;
                const progressPercentage = Math.min(
                  (r.team.lines_completed / 5) * 100,
                  100,
                );

                return (
                  <div
                    key={r.rank}
                    className={`p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-300 ${
                      isTopThree
                        ? "bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10"
                        : ""
                    } ${
                      isCurrentUser
                        ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                        : ""
                    }`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
                      {/* Rank Badge */}
                      <div className="col-span-1 lg:col-span-1 flex justify-center lg:justify-start">
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-xl ${
                            index === 0
                              ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white"
                              : index === 1
                                ? "bg-gradient-to-br from-slate-400 to-slate-500 text-white"
                                : index === 2
                                  ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                                  : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                          }`}
                        >
                          {index < 3 ? ["🥇", "🥈", "🥉"][index] : `#${r.rank}`}
                        </div>
                      </div>

                      {/* Team Info */}
                      <div className="col-span-1 lg:col-span-4">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200">
                            {r.team.team_name}
                          </h3>
                          {isCurrentUser && (
                            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-semibold shadow-sm">
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                              YOU
                            </div>
                          )}
                          {isWinner && (
                            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 text-xs font-semibold shadow-sm">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              WINNER
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-3 overflow-hidden shadow-inner">
                              <div
                                className={`h-full transition-all duration-1000 ease-out rounded-full shadow-sm ${
                                  isWinner
                                    ? "bg-gradient-to-r from-green-400 to-emerald-500"
                                    : "bg-gradient-to-r from-blue-400 to-purple-500"
                                }`}
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 min-w-[3rem] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                              {r.team.lines_completed} lines
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {r.team.lines_completed} lines completed •{" "}
                            {r.team.solved_questions_count || 0} questions
                            solved
                          </div>
                        </div>
                      </div>

                      {/* Time Metrics - Always visible */}
                      <div className="col-span-1 lg:col-span-3 order-first lg:order-none">
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 lg:p-4 space-y-1 lg:space-y-2">
                          <div className="text-center lg:text-left">
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                              {r.team.start_time ? (r.team.end_time ? "Total" : "Current") : "Status"}
                            </div>
                            <div className="font-bold text-lg lg:text-xl text-slate-800 dark:text-slate-200">
                              {r.team.start_time ? formatTime(r.team.time_taken_ms || 0) : "Not started"}
                            </div>
                            {r.team.start_time && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Started: {new Date(r.team.start_time).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </div>
                            )}
                            {r.team.end_time && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Finished: {new Date(r.team.end_time).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status & Rank */}
                      <div className="col-span-1 lg:col-span-4">
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shadow-sm ${
                              isWinner
                                ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200"
                                : r.team.lines_completed > 0
                                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isWinner
                                  ? "bg-green-500"
                                  : r.team.lines_completed > 0
                                    ? "bg-blue-500"
                                    : "bg-slate-400"
                              }`}
                            ></span>
                            {isWinner
                              ? "🏆 Completed"
                              : r.team.lines_completed > 0
                                ? "⚡ In Progress"
                                : "⏳ Not Started"}
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-slate-400 dark:text-slate-500">
                              #{r.rank}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Position
                            </div>
                          </div>
                        </div>

                        {/* Performance Indicator */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                r.rank <= 3
                                  ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                                  : r.rank <= 10
                                    ? "bg-gradient-to-r from-blue-400 to-purple-500"
                                    : "bg-gradient-to-r from-slate-400 to-slate-500"
                              }`}
                              style={{
                                width: `${Math.max(10, 100 - (r.rank - 1) * 5)}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[4rem]">
                            {r.rank <= 3
                              ? "Top Tier"
                              : r.rank <= 10
                                ? "Strong"
                                : "Participant"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {rows.length === 0 && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4 animate-bounce">🏆</div>
                <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  No teams yet
                </h3>
                <p className="text-slate-500 dark:text-slate-500">
                  Teams will appear here as they join the game!
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function formatTime(ms: number) {
  if (ms === 0) return "0:00";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
