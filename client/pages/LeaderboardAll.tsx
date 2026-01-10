import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LeaderboardAllResponse, Team } from "@shared/api";
import { apiFetch } from "../lib/api";

interface RoomLeaderboardData {
  room: {
    code: string;
    title: string;
    gameType: string;
    roundEndAt: string | null;
  };
  rows: Array<{
    team: Team;
    rank: number;
  }>;
  winner: Team | null;
  teamCount: number;
  hasWinner: boolean;
}

type ExtendedLeaderboardAllResponse = {
  [roomCode: string]: RoomLeaderboardData;
};

export default function LeaderboardAllPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ExtendedLeaderboardAllResponse>({});
  const [viewMode, setViewMode] = useState<'rooms' | 'global'>('rooms');
  const [searchRoom, setSearchRoom] = useState('');

  const load = async () => {
    const res = await apiFetch("/api/leaderboard/all");
    if (!res.ok) return;
    const data = (await res.json()) as ExtendedLeaderboardAllResponse;
    setData(data);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  const rooms = Object.entries(data).filter(([code]) => 
    code.toLowerCase().includes(searchRoom.toLowerCase())
  );
  
  // Flatten all teams for global view
  const allTeams = Object.entries(data)
    .flatMap(([roomCode, roomData]) =>
      roomData.rows.map((row) => ({
        ...row,
        room_code: roomCode,
        room_title: roomData.room?.title || roomCode,
      })),
    )
    .sort((a, b) => {
      // Sort by lines completed descending
      if ((b.team.lines_completed ?? 0) !== (a.team.lines_completed ?? 0)) {
        return (b.team.lines_completed ?? 0) - (a.team.lines_completed ?? 0);
      }
      // Then by time ascending
      return (a.team.time_taken_ms ?? 0) - (b.team.time_taken_ms ?? 0);
    })
    .map((t, i) => ({ ...t, globalRank: i + 1 }));

  // Count total winners
  const totalWinners = Object.values(data).filter(r => r.hasWinner).length;
  const totalTeams = allTeams.length;
  const totalRooms = rooms.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-b border-white/20 dark:border-slate-700/50 shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl">🌍</span>
            </div>
            <div>
              <h1 className="font-bold text-2xl text-slate-800 dark:text-slate-200">
                All Rooms Leaderboard
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {totalRooms} rooms
                </span>
                {" • "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {totalTeams} teams
                </span>
                {" • "}
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {totalWinners} winners
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('rooms')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'rooms'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                🏠 By Room
              </button>
              <button
                onClick={() => setViewMode('global')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'global'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                🌐 Global
              </button>
            </div>
            <button
              onClick={() => navigate("/admin")}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {viewMode === 'rooms' ? (
          <div className="space-y-6">
            {/* Search and Stats */}
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={searchRoom}
                onChange={(e) => setSearchRoom(e.target.value)}
                placeholder="Search rooms..."
                className="flex-1 max-w-md rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
              />
            </div>

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map(([roomCode, roomData]) => {
                const winner = roomData.winner;
                const topTeams = roomData.rows.slice(0, 3);
                const hasWinner = roomData.hasWinner;

                return (
                  <div
                    key={roomCode}
                    className={`bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer ${
                      hasWinner 
                        ? 'border-green-300 dark:border-green-600 ring-2 ring-green-200 dark:ring-green-800' 
                        : 'border-white/20 dark:border-slate-700/50'
                    }`}
                    onClick={() => navigate(`/leaderboard?room=${roomCode}`)}
                  >
                    {/* Room Header */}
                    <div className={`p-4 ${
                      hasWinner 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                        : 'bg-gradient-to-r from-purple-600 to-pink-600'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            🏠 {roomData.room?.title || roomCode}
                          </h3>
                          <p className="text-white/80 text-sm">
                            Code: {roomCode} • {roomData.teamCount} teams
                          </p>
                        </div>
                        {hasWinner && (
                          <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
                            <span className="text-lg">🏆</span>
                            <span className="text-white text-xs font-semibold">HAS WINNER</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Winner Section */}
                    {winner && (
                      <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-b border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                            <span className="text-2xl">👑</span>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold uppercase">
                              🎉 Room Winner
                            </div>
                            <div className="font-bold text-lg text-slate-800 dark:text-slate-200">
                              {winner.team_name}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                              <span>⏱️ {formatTime(winner.time_taken_ms || 0)}</span>
                              <span>📏 {winner.lines_completed}/5 lines</span>
                              <span>✅ {winner.solved_questions_count || 0} solved</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Top 3 Teams */}
                    <div className="p-4">
                      <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
                        Top Performers
                      </h4>
                      <div className="space-y-2">
                        {topTeams.length > 0 ? (
                          topTeams.map((row, idx) => (
                            <div
                              key={row.team.id}
                              className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50"
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                  idx === 0
                                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                                    : idx === 1
                                    ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white'
                                    : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                                }`}
                              >
                                {['🥇', '🥈', '🥉'][idx]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {row.team.team_name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {row.team.lines_completed}/5 lines • {formatTime(row.team.time_taken_ms || 0)}
                                </div>
                              </div>
                              {row.team.lines_completed >= 5 && (
                                <span className="text-green-500 text-lg">✓</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                            <span className="text-2xl">👥</span>
                            <p className="text-sm mt-1">No teams yet</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* View Full Leaderboard Link */}
                    <div className="px-4 pb-4">
                      <button
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-slate-700 dark:text-slate-200 font-medium text-sm hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/leaderboard?room=${roomCode}`);
                        }}
                      >
                        View Full Leaderboard →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {rooms.length === 0 && (
              <div className="text-center py-16 bg-white/90 dark:bg-slate-800/90 rounded-2xl shadow-xl">
                <div className="text-6xl mb-4 animate-bounce">🏠</div>
                <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  No rooms found
                </h3>
                <p className="text-slate-500 dark:text-slate-500">
                  {searchRoom ? 'Try a different search term' : 'Create a room to get started!'}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Global View */
          <div className="space-y-6">
            {/* Top 3 Global Champions */}
            {allTeams.length >= 3 && (
              <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-8 shadow-2xl animate-in slide-in-from-top-5">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                    🌟 Global Champions
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    The best teams across all rooms!
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 2nd Place */}
                  <div className="order-1 md:order-1 transform hover:scale-105 transition-all duration-300">
                    <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-600">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg">
                          <span className="text-2xl">🥈</span>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                          2nd Place
                        </div>
                        <div className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">
                          {allTeams[1]?.team.team_name}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          Room: {allTeams[1]?.room_code}
                        </div>
                        <div className="flex items-center justify-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 dark:text-blue-400">
                              📏
                            </span>
                            <span className="font-semibold">
                              {allTeams[1]?.team.lines_completed}/5
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-green-600 dark:text-green-400">
                              ⏱️
                            </span>
                            <span className="font-semibold">
                              {formatTime(allTeams[1]?.team.time_taken_ms || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 1st Place */}
                  <div className="order-2 md:order-2 transform hover:scale-105 transition-all duration-300">
                    <div className="bg-gradient-to-br from-yellow-100 via-yellow-50 to-amber-100 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-8 shadow-2xl border-2 border-yellow-300 dark:border-yellow-600 relative">
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg animate-bounce">
                          <span className="text-2xl">👑</span>
                        </div>
                      </div>
                      <div className="text-center pt-4">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-xl animate-pulse">
                          <span className="text-3xl">🥇</span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-200 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 text-sm font-semibold mb-2">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                          GLOBAL LEADER
                        </div>
                        <div className="font-bold text-2xl text-slate-800 dark:text-slate-200 mb-1">
                          {allTeams[0]?.team.team_name}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          Room: {allTeams[0]?.room_code}
                        </div>
                        <div className="flex items-center justify-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 dark:text-blue-400">
                              📏
                            </span>
                            <span className="font-bold text-lg">
                              {allTeams[0]?.team.lines_completed}/5
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-green-600 dark:text-green-400">
                              ⏱️
                            </span>
                            <span className="font-bold text-lg">
                              {formatTime(allTeams[0]?.team.time_taken_ms || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="order-3 md:order-3 transform hover:scale-105 transition-all duration-300">
                    <div className="bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 shadow-lg border border-amber-200 dark:border-amber-600">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                          <span className="text-2xl">🥉</span>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                          3rd Place
                        </div>
                        <div className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">
                          {allTeams[2]?.team.team_name}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          Room: {allTeams[2]?.room_code}
                        </div>
                        <div className="flex items-center justify-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 dark:text-blue-400">
                              📏
                            </span>
                            <span className="font-semibold">
                              {allTeams[2]?.team.lines_completed}/5
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-green-600 dark:text-green-400">
                              ⏱️
                            </span>
                            <span className="font-semibold">
                              {formatTime(allTeams[2]?.team.time_taken_ms || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full Global Leaderboard Table */}
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 duration-700">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="text-3xl">🏆</span>
                  Global Rankings
                </h2>
                <p className="text-purple-100 mt-1">All teams across all rooms</p>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {allTeams.map((r, index) => {
                  const isTopThree = index < 3;
                  const isWinner = (r.team.lines_completed ?? 0) >= 5;
                  const progressPercentage = ((r.team.lines_completed ?? 0) / 5) * 100;

                  return (
                    <div
                      key={`${r.room_code}-${r.team.id}`}
                      className={`p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-300 cursor-pointer ${
                        isTopThree
                          ? "bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-900/10"
                          : ""
                      }`}
                      onClick={() => navigate(`/leaderboard?room=${r.room_code}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Rank Badge */}
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg ${
                              index === 0
                                ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white"
                                : index === 1
                                  ? "bg-gradient-to-br from-slate-400 to-slate-500 text-white"
                                  : index === 2
                                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                                    : "bg-gradient-to-br from-purple-500 to-pink-600 text-white"
                            }`}
                          >
                            {index < 3 ? ["🥇", "🥈", "🥉"][index] : `#${r.globalRank}`}
                          </div>

                          {/* Team Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">
                                {r.team.team_name}
                              </h3>
                              {isWinner && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                  WINNER
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-4 mb-3">
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-sm font-medium">
                                <span className="text-lg">🏠</span>
                                {r.room_title}
                              </div>
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                ✅ {r.team.solved_questions_count || 0} questions solved
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex-1 max-w-xs bg-slate-200 dark:bg-slate-600 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-1000 ease-out rounded-full ${
                                    isWinner
                                      ? "bg-gradient-to-r from-green-400 to-emerald-500"
                                      : "bg-gradient-to-r from-purple-400 to-pink-500"
                                  }`}
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 min-w-[3rem]">
                                {r.team.lines_completed}/5
                              </span>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                              <div className="flex items-center gap-1">
                                <span>⏱️</span>
                                <span className="font-medium">
                                  {formatTime(r.team.time_taken_ms ?? 0)}
                                </span>
                              </div>
                              <div
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isWinner
                                    ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200"
                                    : (r.team.lines_completed ?? 0) > 0
                                      ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200"
                                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isWinner
                                      ? "bg-green-500"
                                      : (r.team.lines_completed ?? 0) > 0
                                        ? "bg-purple-500"
                                        : "bg-slate-400"
                                  }`}
                                ></span>
                                {isWinner
                                  ? "Completed"
                                  : (r.team.lines_completed ?? 0) > 0
                                    ? "In Progress"
                                    : "Not Started"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Rank Number */}
                        <div className="text-right">
                          <div className="text-3xl font-bold text-slate-400 dark:text-slate-500">
                            #{r.globalRank}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {allTeams.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4 animate-bounce">🌍</div>
                  <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    No teams yet
                  </h3>
                  <p className="text-slate-500 dark:text-slate-500">
                    Global leaderboard will populate as teams complete games!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
