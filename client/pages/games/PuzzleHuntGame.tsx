import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Question, Team } from "@shared/api";
import { apiFetch } from "../../lib/api";

interface PuzzleState {
  currentPuzzleIndex: number;
  solvedPuzzles: Set<number>;
  hints: number;
  timeElapsed: number;
  userAnswer: string;
  showHint: boolean;
  showResult: boolean;
  isCorrect: boolean;
}

export default function PuzzleHuntGame() {
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [puzzles, setPuzzles] = useState<Question[]>([]);
  const [puzzleState, setPuzzleState] = useState<PuzzleState>({
    currentPuzzleIndex: 0,
    solvedPuzzles: new Set(),
    hints: 3,
    timeElapsed: 0,
    userAnswer: "",
    showHint: false,
    showResult: false,
    isCorrect: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawTeam = localStorage.getItem("bingo.team");
    try {
      const t = rawTeam && rawTeam !== "undefined" ? JSON.parse(rawTeam) : null;
      if (!t) {
        navigate("/");
        return;
      }
      setTeam(t);
      loadPuzzles(t);
    } catch {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    // Timer
    const interval = setInterval(() => {
      setPuzzleState((prev) => ({ ...prev, timeElapsed: prev.timeElapsed + 1 }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadPuzzles = async (t: Team) => {
    try {
      const res = await apiFetch(`/api/game-state?teamId=${t.team_id}`);
      const data = await res.json();
      setPuzzles(data.questions || []);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load puzzles:", err);
      setLoading(false);
    }
  };

  const handleUseHint = () => {
    if (puzzleState.hints > 0 && !puzzleState.showHint) {
      setPuzzleState((prev) => ({
        ...prev,
        hints: prev.hints - 1,
        showHint: true,
      }));
    }
  };

  const handleSubmitAnswer = () => {
    const currentPuzzle = puzzles[puzzleState.currentPuzzleIndex];
    const userAns = puzzleState.userAnswer.trim().toLowerCase();
    const correctAns = (currentPuzzle.correct_answer || String(currentPuzzle.correctAnswer)).toLowerCase();
    const isCorrect = userAns === correctAns;

    setPuzzleState((prev) => ({
      ...prev,
      showResult: true,
      isCorrect,
      solvedPuzzles: isCorrect ? new Set([...prev.solvedPuzzles, prev.currentPuzzleIndex]) : prev.solvedPuzzles,
    }));
  };

  const handleNextPuzzle = () => {
    if (puzzleState.currentPuzzleIndex < puzzles.length - 1) {
      setPuzzleState((prev) => ({
        ...prev,
        currentPuzzleIndex: prev.currentPuzzleIndex + 1,
        userAnswer: "",
        showHint: false,
        showResult: false,
        isCorrect: false,
      }));
    } else {
      navigate("/congratulations");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 dark:text-slate-400 mt-4">Loading Puzzles...</p>
        </div>
      </div>
    );
  }

  if (puzzles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl">
          <p className="text-xl text-slate-700 dark:text-slate-300">No puzzles available</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const currentPuzzle = puzzles[puzzleState.currentPuzzleIndex];
  const progress = (puzzleState.solvedPuzzles.size / puzzles.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="max-w-5xl mx-auto pt-8">
        {/* Header */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">🔍 Code Puzzle Hunt</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Team: {team?.team_name}</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{puzzleState.solvedPuzzles.size}/{puzzles.length}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Solved</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{puzzleState.hints}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Hints</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatTime(puzzleState.timeElapsed)}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Time</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Puzzle Card */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Puzzle #{puzzleState.currentPuzzleIndex + 1}
            </h2>
            <button
              onClick={handleUseHint}
              disabled={puzzleState.hints === 0 || puzzleState.showHint}
              className="px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              💡 Use Hint ({puzzleState.hints} left)
            </button>
          </div>

          {/* Puzzle Code */}
          <div className="mb-6 bg-slate-900 dark:bg-slate-950 rounded-xl p-6 border border-slate-700">
            <code className="text-sm text-slate-100 font-mono whitespace-pre-wrap block">
{currentPuzzle.question_text || currentPuzzle.text}
            </code>
          </div>

          {/* Hint Section */}
          {puzzleState.showHint && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700">
              <p className="text-amber-900 dark:text-amber-200 font-medium">
                💡 Hint: Look for patterns in the variable names and output format
              </p>
            </div>
          )}

          {/* Answer Input */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Your Answer:
            </label>
            <input
              type="text"
              value={puzzleState.userAnswer}
              onChange={(e) => setPuzzleState((prev) => ({ ...prev, userAnswer: e.target.value }))}
              disabled={puzzleState.showResult}
              placeholder="Enter your answer..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 disabled:opacity-50 font-mono"
            />
          </div>

          {/* Result Message */}
          {puzzleState.showResult && (
            <div className={`mb-6 p-4 rounded-xl ${
              puzzleState.isCorrect
                ? "bg-green-100 dark:bg-green-900/30 border-2 border-green-500"
                : "bg-red-100 dark:bg-red-900/30 border-2 border-red-500"
            }`}>
              <p className={`font-bold mb-1 ${
                puzzleState.isCorrect ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
              }`}>
                {puzzleState.isCorrect ? "🎉 Correct! You solved the puzzle!" : "❌ Not quite right. Try again!"}
              </p>
              {!puzzleState.isCorrect && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Correct answer: <code className="font-bold">{currentPuzzle.correct_answer || currentPuzzle.correctAnswer}</code>
                </p>
              )}
            </div>
          )}

          {/* Action Button */}
          <div>
            {!puzzleState.showResult ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!puzzleState.userAnswer.trim()}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                Check Answer
              </button>
            ) : (
              <button
                onClick={handleNextPuzzle}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl"
              >
                {puzzleState.currentPuzzleIndex < puzzles.length - 1 ? "Next Puzzle →" : "Complete Hunt 🎉"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
