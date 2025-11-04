import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ErrorResponse, LoginRequest, LoginResponse } from "@shared/api";
import { ThemeToggle } from "../components/ThemeProvider";
import { apiFetch } from "../lib/api";

export default function Index() {
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isAdmin = localStorage.getItem("bingo.admin") === "true";
    if (isAdmin) {
      navigate("/admin");
      return;
    }
    // If already logged in, go to game
    const saved = localStorage.getItem("bingo.team");
    try {
      const parsed =
        saved && saved !== "undefined" && saved !== "null"
          ? JSON.parse(saved)
          : null;
      if (parsed && parsed.id) {
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
      teamName.trim().toLowerCase() === "admin" &&
      roomCode.trim().toUpperCase() === "ADMIN2907"
    ) {
      localStorage.setItem("bingo.admin", "true");
      localStorage.removeItem("bingo.team");
      localStorage.removeItem("bingo.room");
      navigate("/admin");
      return;
    }

    setLoading(true);
    try {
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
      localStorage.setItem("bingo.team", JSON.stringify(success.team));
      localStorage.setItem("bingo.room", JSON.stringify(success.room));
      localStorage.removeItem("bingo.admin");
      navigate("/game");
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center px-4 relative">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            🏆 Bingo Mania 🏆
          </h1>
          <p className="text-muted-foreground">
            Enter your team name and join the coding challenge
          </p>
        </div>
        <form
          onSubmit={submit}
          className="bg-card shadow-xl rounded-xl border border-border p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Team Name
            </label>
            <input
              className="w-full rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              placeholder="e.g. Code Ninjas"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Room Code
            </label>
            <input
              className="w-full rounded-lg border border-input bg-background px-3 py-2 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              placeholder="e.g. ABC123"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
          </div>
          {error && (
            <div className="text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
            )}
            {loading ? "Joining..." : "🚀 Join Game"}
          </button>
        </form>
      </div>
    </div>
  );
}
