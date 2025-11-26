// Unified Game Header Component
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Team, Room } from "@shared/api";
import { clearGameData } from "../lib/localStorage";
import { Button } from "@/components/ui/button";
import GameTimer from "./GameTimer";

interface GameHeaderProps {
  gameTitle: string;
  gameIcon: string;
  team: Team | null;
  room: Room | null;
  extraInfo?: React.ReactNode;
  showAchievements?: boolean;
  showLeaderboard?: boolean;
  hideRoomTimer?: boolean;
}

export default function GameHeader({
  gameTitle,
  gameIcon,
  team,
  room,
  extraInfo,
  showAchievements = true,
  showLeaderboard = true,
  hideRoomTimer = false,
}: GameHeaderProps) {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<"not-started" | "active" | "ended">("not-started");

  useEffect(() => {
    if (!room?.roundEndAt) {
      setGameStatus("not-started");
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const endTime = new Date(room.roundEndAt!).getTime();
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setGameStatus("ended");
        setTimeLeft("00:00:00");
        return;
      }

      setGameStatus("active");
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.roundEndAt]);

  const handleLogout = () => {
    clearGameData();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/20 dark:border-slate-800/20 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/40 dark:supports-[backdrop-filter]:bg-slate-950/40 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: Logo and Info */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-500/40 transform transition-all duration-300 hover:scale-110 hover:rotate-6 hover:shadow-2xl hover:shadow-purple-500/60">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 to-transparent"></div>
              <span className="text-2xl sm:text-3xl filter drop-shadow-lg relative z-10">{gameIcon}</span>
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30 blur animate-pulse"></div>
            </div>
            <div className="flex-1">
              <h1 className="font-black text-xl sm:text-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent leading-tight tracking-tight drop-shadow-sm">
                {gameTitle}
              </h1>
              <div className="flex items-center gap-2.5 text-sm sm:text-base font-bold">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/70 dark:to-indigo-900/70 border-2 border-blue-300 dark:border-blue-600 shadow-md">
                  <span className="text-base">👥</span>
                  <span className="text-blue-800 dark:text-blue-200">{team?.name || team?.team_name || "Loading..."}</span>
                </div>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border border-purple-200/50 dark:border-purple-700/50 shadow-sm">
                  <span className="text-xs">🎮</span>
                  <span className="text-purple-700 dark:text-purple-300 opacity-90">Room {room?.code || "..."}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Extra Info and Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
            {/* Contest Timer */}
            {!hideRoomTimer && (
              <GameTimer
                time={timeLeft || "00:00:00"}
                type="countdown"
                variant={gameStatus === "ended" ? "critical" : "default"}
              />
            )}

            {/* Extra info */}
            {extraInfo && (
              <div className="flex items-center gap-2">
                {extraInfo}
              </div>
            )}

            <div className="flex items-center gap-2">
              {showAchievements && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/achievements")}
                  className="hidden sm:flex items-center gap-2 h-10 px-4 text-sm font-bold text-amber-700 hover:text-amber-800 bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/40 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:from-amber-950/60 dark:hover:to-yellow-950/60 rounded-xl border border-amber-300/50 dark:border-amber-700/50 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
                  title="View Achievements"
                >
                  <span className="text-lg">🏆</span>
                  <span className="hidden lg:inline">Achievements</span>
                </Button>
              )}

              {showLeaderboard && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/leaderboard")}
                  className="hidden sm:flex items-center gap-2 h-10 px-4 text-sm font-bold text-blue-700 hover:text-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 dark:from-blue-950/40 dark:to-cyan-950/40 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:from-blue-950/60 dark:hover:to-cyan-950/60 rounded-xl border border-blue-300/50 dark:border-blue-700/50 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
                  title="View Leaderboard"
                >
                  <span className="text-lg">📊</span>
                  <span className="hidden lg:inline">Leaderboard</span>
                </Button>
              )}

              <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent dark:via-slate-600 hidden sm:block mx-1"></div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-10 px-4 text-sm font-bold text-red-700 hover:text-white bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-500 hover:to-rose-500 dark:from-red-950/40 dark:to-rose-950/40 dark:text-red-400 dark:hover:text-white dark:hover:from-red-600 dark:hover:to-rose-600 rounded-xl border border-red-300/50 dark:border-red-700/50 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
                title="Logout"
              >
                <span className="text-lg">🚪</span>
                <span className="hidden sm:inline ml-2">Exit</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
