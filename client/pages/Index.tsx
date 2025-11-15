import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ErrorResponse, LoginRequest, LoginResponse } from "@shared/api";
import { ThemeToggle } from "../components/ThemeProvider";
import { apiFetch } from "../lib/api";
import { clearGameData, saveGameData, setAdmin } from "../lib/localStorage";

export default function Index() {
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, go to game
    const saved = localStorage.getItem("bingo.team");
    try {
      const parsed =
        saved && saved !== "undefined" && saved !== "null"
          ? JSON.parse(saved)
          : null;
      if (parsed && parsed.team_id) {
        localStorage.removeItem("bingo.admin");
        navigate("/game");
      }
    } catch {
      // ignore corrupted data
    }
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!teamName.trim()) {
      setError("Team name is required");
      return;
    }
    if (!roomCode.trim()) {
      setError("Room code is required");
      return;
    }

    // Admin quick login
    if (
      teamName.trim().toUpperCase() === "ADMINLOGIN" &&
      roomCode.trim() === "HELLOWORLD@123"
    ) {
      // Clear all game data before admin login
      clearGameData();
      setAdmin(true);
      navigate("/admin");
      return;
    }

    setLoading(true);
    try {
      // Clear all previous game data before new login to prevent data mixing
      clearGameData();
      
      const body: LoginRequest = {
        team_name: teamName.trim(),
        room_code: roomCode.trim(),
      };
      const res = await apiFetch("/api/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as LoginResponse | ErrorResponse;
      if (!res.ok || ("ok" in data && data.ok === false)) {
        const msg = (data as ErrorResponse).error || "Login failed";
        setError(msg);
        return;
      }
      const success = data as LoginResponse;
      
      // Store new team and room data using utility function
      saveGameData(success.team, success.room);
      
      navigate("/game");
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-black dark:via-slate-950 dark:to-slate-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating orbs */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-600/10 dark:bg-blue-600/20 rounded-full blur-3xl animate-pulse" style={{ animation: 'float 8s ease-in-out infinite' }}></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-600/10 dark:bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s', animation: 'float 8s ease-in-out infinite reverse' }}></div>
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-3xl" style={{ animation: 'float 12s ease-in-out infinite' }}></div>
      </div>

      {/* Grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md z-10">
        {/* Animated header */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-6 duration-1000">
          <div className="inline-block mb-4">
            <div className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
              🏆
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent animate-gradient">
            Bingo Mania
          </h1>
          <p className="text-slate-700 dark:text-slate-300 text-lg">
            Enter your team name and join the coding challenge
          </p>
        </div>

        {/* Glossy form container */}
        <form
          onSubmit={submit}
          className="bg-white/90 dark:bg-slate-800/40 backdrop-blur-2xl border border-slate-200 dark:border-slate-700/50 rounded-2xl p-8 space-y-5 shadow-2xl hover:shadow-2xl transition-all duration-700 animate-in fade-in slide-in-from-bottom-4 delay-200 ring-1 ring-slate-300/20 dark:ring-slate-600/20"
        >
          {/* Team Name Input */}
          <div className="group">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              <span className="text-lg">👥</span>
              Team Name
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600/50 px-4 py-3 bg-white dark:bg-slate-700/40 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 dark:focus:bg-slate-700/60 transition-all shadow-lg backdrop-blur-sm group-hover:border-slate-400 dark:group-hover:border-slate-500/50 duration-300"
                placeholder="e.g. Code Ninjas"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all pointer-events-none"></div>
            </div>
          </div>

          {/* Room Code Input */}
          <div className="group">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              <span className="text-lg">🔐</span>
              Room Code
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600/50 px-4 py-3 bg-white dark:bg-slate-700/40 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 dark:focus:bg-slate-700/60 transition-all shadow-lg backdrop-blur-sm group-hover:border-slate-400 dark:group-hover:border-slate-500/50 duration-300"
                placeholder="e.g. ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 transition-all pointer-events-none"></div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-700/50 rounded-xl px-4 py-3 backdrop-blur-sm flex items-center gap-2 animate-shake">
              <span className="text-lg">⚠️</span>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 text-white text-base font-bold rounded-xl py-3.5 shadow-xl hover:shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-300 transform hover:-translate-y-1 border border-blue-400/20 hover:border-blue-400/50 group"
          >
            {loading && (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            )}
            <span>{loading ? 'Joining...' : '🚀 Join Game'}</span>
            {!loading && (
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
          </button>
        </form>

        {/* Footer info */}
        <p className="text-center text-slate-600 dark:text-slate-400 text-sm mt-6 animate-in fade-in duration-1000 delay-500">
          ✨ Challenge your coding skills with your team
        </p>
      </div>

      {/* Animated CSS */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(30px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .bg-grid-pattern {
          background-image: 
            linear-gradient(0deg, transparent 24%, rgba(255, 0, 0, 0.05) 25%, rgba(255, 0, 0, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 0, 0, 0.05) 75%, rgba(255, 0, 0, 0.05) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(255, 0, 0, 0.05) 25%, rgba(255, 0, 0, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 0, 0, 0.05) 75%, rgba(255, 0, 0, 0.05) 76%, transparent 77%, transparent);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  );
}
