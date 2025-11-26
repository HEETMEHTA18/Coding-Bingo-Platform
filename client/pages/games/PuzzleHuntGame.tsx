// Code Puzzle Hunt Game
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Question, Team } from "@shared/api";
import { apiFetch } from "../../lib/api";
import GameHeader from "../../components/GameHeader";
import { Button } from "@/components/ui/button";
import GameTimer from "../../components/GameTimer";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
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
      toast({
        title: "💡 Hint Used",
        description: `You have ${puzzleState.hints - 1} hints remaining.`,
      });
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

    if (isCorrect) {
      toast({
        title: "🎉 Correct!",
        description: "Great job! Moving to the next puzzle...",
        className: "bg-green-50 border-green-200 text-green-800",
      });
    } else {
      toast({
        title: "❌ Incorrect",
        description: "Try again!",
        variant: "destructive",
      });
    }
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
          <Button
            onClick={() => navigate("/")}
            className="mt-4"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const currentPuzzle = puzzles[puzzleState.currentPuzzleIndex];
  const progress = (puzzleState.solvedPuzzles.size / puzzles.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <GameHeader
        gameTitle="Code Puzzle Hunt"
        gameIcon="🔍"
        team={team}
        room={null} // Room might not be available in this context based on original code, but GameHeader handles null
        hideRoomTimer={true}
        extraInfo={
          <div className="flex gap-3">
            <GameTimer time={puzzleState.timeElapsed} type="elapsed" />
            <Badge variant="outline" className="text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800">
              💡 Hints: {puzzleState.hints}
            </Badge>
          </div>
        }
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Progress Section */}
        <Card className="mb-8 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-indigo-100 dark:border-indigo-900 shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Progress</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </Card>

        {/* Puzzle Card */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <Badge className="mb-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300">
                  Puzzle #{puzzleState.currentPuzzleIndex + 1}
                </Badge>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Crack the Code
                </h2>
              </div>
              <Button
                onClick={handleUseHint}
                disabled={puzzleState.hints === 0 || puzzleState.showHint}
                variant="outline"
                className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
              >
                💡 Use Hint
              </Button>
            </div>

            {/* Puzzle Code */}
            <div className="mb-8 bg-slate-950 rounded-xl p-6 border border-slate-800 shadow-inner relative group">
              <div className="absolute top-3 right-3 flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/20 group-hover:bg-red-500 transition-colors" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 group-hover:bg-yellow-500 transition-colors" />
                <div className="w-3 h-3 rounded-full bg-green-500/20 group-hover:bg-green-500 transition-colors" />
              </div>
              <code className="text-sm sm:text-base text-indigo-300 font-mono whitespace-pre-wrap block leading-relaxed pt-4">
                {currentPuzzle.question_text || currentPuzzle.text}
              </code>
            </div>

            {/* Hint Section */}
            {puzzleState.showHint && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                <span className="text-xl">💡</span>
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm mb-1">Hint Revealed</h4>
                  <p className="text-amber-800 dark:text-amber-300 text-sm">
                    Look for patterns in the variable names and output format.
                  </p>
                </div>
              </div>
            )}

            {/* Answer Input */}
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="relative">
                <Input
                  type="text"
                  value={puzzleState.userAnswer}
                  onChange={(e) => setPuzzleState((prev) => ({ ...prev, userAnswer: e.target.value }))}
                  disabled={puzzleState.showResult}
                  placeholder="Enter your answer..."
                  className="pl-4 pr-12 py-6 text-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-indigo-500"
                  onKeyDown={(e) => e.key === "Enter" && !puzzleState.showResult && handleSubmitAnswer()}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌨️
                </div>
              </div>

              {/* Result Message */}
              {puzzleState.showResult && (
                <div className={`p-4 rounded-xl text-center animate-in zoom-in duration-300 ${puzzleState.isCorrect
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  }`}>
                  <p className={`font-bold text-lg mb-1 ${puzzleState.isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                    }`}>
                    {puzzleState.isCorrect ? "🎉 Correct Answer!" : "❌ Not quite right"}
                  </p>
                  {!puzzleState.isCorrect && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      The correct answer was: <code className="font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{currentPuzzle.correct_answer || currentPuzzle.correctAnswer}</code>
                    </p>
                  )}
                </div>
              )}

              {/* Action Button */}
              <div className="pt-4">
                {!puzzleState.showResult ? (
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={!puzzleState.userAnswer.trim()}
                    className="w-full py-6 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"
                  >
                    Check Answer
                  </Button>
                ) : (
                  <Button
                    onClick={handleNextPuzzle}
                    className={`w-full py-6 text-lg font-bold shadow-lg ${puzzleState.isCorrect
                      ? "bg-green-600 hover:bg-green-700 shadow-green-200 dark:shadow-green-900/20"
                      : "bg-slate-700 hover:bg-slate-800"
                      }`}
                  >
                    {puzzleState.currentPuzzleIndex < puzzles.length - 1 ? "Next Puzzle →" : "Complete Hunt 🎉"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
