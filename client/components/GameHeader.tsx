// Unified Game Header Component
import { useNavigate } from "react-router-dom";
import type { Team, Room } from "@shared/api";
import { clearGameData } from "../lib/localStorage";

interface GameHeaderProps {
  gameTitle: string;
  gameIcon: string;
  team: Team | null;
  room: Room | null;
  extraInfo?: React.ReactNode;
  showAchievements?: boolean;
  showLeaderboard?: boolean;
}

export default function GameHeader({
  gameTitle,
  gameIcon,
  team,
  room,
  extraInfo,
  showAchievements = true,
  showLeaderboard = true,
}: GameHeaderProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearGameData();
    navigate("/");
  };

  return (
    <header className="border-b border-slate-800 bg-[#1e293b] shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left: Logo and Info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
              <span className="text-2xl">{gameIcon}</span>
            </div>
            <div>
              <h1 className="font-bold text-xl text-white">{gameTitle}</h1>
              <p className="text-sm text-slate-400">
                <span className="text-green-400">●</span> Team: {team?.team_name || "Unknown"} · Room: {room?.code || "N/A"}
              </p>
            </div>
          </div>

          {/* Right: Extra Info and Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Extra info (e.g., timer, progress) */}
            {extraInfo}

            {/* Navigation Buttons */}
            {showAchievements && (
              <button
                onClick={() => navigate("/achievements")}
                className="px-3 sm:px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-all transform hover:scale-105 flex items-center gap-2 shadow-md"
                title="View Achievements"
              >
                <span>🏆</span>
                <span className="hidden sm:inline">Achievements</span>
              </button>
            )}

            {showLeaderboard && (
              <button
                onClick={() => navigate("/leaderboard")}
                className="px-3 sm:px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-all transform hover:scale-105 flex items-center gap-2 shadow-md"
                title="View Leaderboard"
              >
                <span>📊</span>
                <span className="hidden sm:inline">Leaderboard</span>
              </button>
            )}

            {/* Logout Button - Always Visible */}
            <button
              onClick={handleLogout}
              className="px-3 sm:px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all transform hover:scale-105 flex items-center gap-2 shadow-md"
              title="Logout"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
