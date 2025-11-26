// Code Sudoku Game Component with Questions & Hints
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import GameHeader from "../../components/GameHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Team, Room, GameStateResponse } from "@shared/api";

function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    if (raw === "undefined" || raw === "null") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type SudokuCell = {
  value: string | null;
  isFixed: boolean;
  isCorrect: boolean;
  row: number;
  col: number;
  notes?: string[];
};

type Question = {
  id: string;
  question_id: number;
  question_text: string;
  is_real: boolean;
};

type HintOption = {
  symbol: string;
  row: number;
  col: number;
  isUnlocked: boolean;
};

export default function SudokuGame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  const [gridSize] = useState<6 | 9>(9);
  const [grid, setGrid] = useState<SudokuCell[][]>([]);
  const [symbols] = useState<string[]>(["if", "else", "for", "while", "return", "break", "int", "char", "float"]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Questions system
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [solvedQuestions, setSolvedQuestions] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Hints system
  const [availableHints, setAvailableHints] = useState<HintOption[]>([]);
  const [hintsUnlocked, setHintsUnlocked] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Keywords unlock system
  const [unlockedKeywords, setUnlockedKeywords] = useState<string[]>([]);

  useEffect(() => {
    if (!team || !room) {
      navigate("/");
      return;
    }

    const teamId = team.team_id || team.id;
    if (!teamId || !room.code) {
      console.warn("⚠️ Sudoku: Invalid team/room data");
      localStorage.clear();
      navigate("/");
      return;
    }

    loadGameState();
  }, [team, room, navigate]);

  const loadGameState = async () => {
    if (!team || !room) return;

    const teamId = team.team_id || team.id;
    const res = await fetch(`/api/game?room=${encodeURIComponent(room.code)}&team=${encodeURIComponent(teamId)}`);

    if (!res.ok) {
      toast({ title: "Failed to load game", variant: "destructive" });
      return;
    }

    const data = await res.json() as GameStateResponse;
    if (data.questions && data.questions.length > 0) {
      const mappedQuestions: Question[] = data.questions.map(q => ({
        id: q.id,
        question_id: q.question_id || 0,
        question_text: q.question_text || q.text,
        is_real: q.is_real ?? true,
      }));
      setQuestions(mappedQuestions);
    }
  };

  useEffect(() => {
    initializeGrid();
  }, [gridSize]);

  const initializeGrid = () => {
    const newGrid: SudokuCell[][] = [];
    const hints: HintOption[] = [];

    for (let i = 0; i < gridSize; i++) {
      const row: SudokuCell[] = [];
      for (let j = 0; j < gridSize; j++) {
        const isFixed = Math.random() < 0.25; // 25% pre-filled
        const symbol = isFixed ? symbols[Math.floor(Math.random() * symbols.length)] : null;

        row.push({
          value: symbol,
          isFixed,
          isCorrect: true,
          row: i,
          col: j,
        });

        if (!isFixed) {
          hints.push({
            symbol: symbols[Math.floor(Math.random() * symbols.length)],
            row: i,
            col: j,
            isUnlocked: false,
          });
        }
      }
      newGrid.push(row);
    }

    setGrid(newGrid);
    setAvailableHints(hints.slice(0, 15));
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      toast({ title: "Please enter an answer", variant: "default" });
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setSubmitting(true);
    try {
      const teamId = team?.team_id || team?.id;
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: room?.code,
          teamId: String(teamId),
          questionId: String(currentQuestion.id),
          answer: answer,
        }),
      });

      if (!res.ok) {
        let errMsg = `Submit failed: ${res.status}`;
        try {
          const body = await res.text();
          try {
            const j = JSON.parse(body);
            if (j && j.error) errMsg = `${errMsg} - ${j.error}`;
          } catch { }
        } catch { }
        throw new Error(errMsg);
      }

      const result = await res.json();

      if (result.correct) {
        setSolvedQuestions(prev => [...prev, currentQuestionIndex]);

        const nextKeywordIndex = unlockedKeywords.length;
        if (nextKeywordIndex < symbols.length) {
          const newKeyword = symbols[nextKeywordIndex];
          setUnlockedKeywords(prev => [...prev, newKeyword]);
          toast({
            title: "✅ Correct!",
            description: `Keyword "${newKeyword}" unlocked!`,
            className: "bg-green-50 border-green-200 text-green-800"
          });
        } else {
          toast({
            title: "✅ Correct!",
            description: "All keywords already unlocked!",
            className: "bg-green-50 border-green-200 text-green-800"
          });
        }

        const nextHintIndex = hintsUnlocked;
        if (nextHintIndex < availableHints.length) {
          const newHints = [...availableHints];
          newHints[nextHintIndex] = { ...newHints[nextHintIndex], isUnlocked: true };
          setAvailableHints(newHints);
          setHintsUnlocked(prev => prev + 1);
        }

        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setAnswer("");
        }
      } else {
        toast({
          title: "❌ Incorrect",
          description: "Try again or move to the next question",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      toast({ title: "Failed to submit answer", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseHint = (hint: HintOption) => {
    if (!hint.isUnlocked) {
      toast({ title: "🔒 Hint Locked", description: "Answer more questions to unlock this hint", variant: "default" });
      return;
    }

    const newGrid = [...grid];
    newGrid[hint.row][hint.col] = {
      ...newGrid[hint.row][hint.col],
      value: hint.symbol,
      isCorrect: true,
      isFixed: true,
    };
    setGrid(newGrid);
    setHintsUsed(prev => prev + 1);

    toast({
      title: "💡 Hint Used!",
      description: `Revealed: ${hint.symbol} at row ${hint.row + 1}, col ${hint.col + 1}`,
    });

    checkCompletion(newGrid);
  };

  const handleCellClick = (row: number, col: number) => {
    if (grid[row][col].isFixed) return;
    setSelectedCell({ row, col });
  };

  const handleSymbolSelect = (symbol: string) => {
    if (!unlockedKeywords.includes(symbol)) {
      toast({
        title: "🔒 Keyword Locked",
        description: "Answer questions correctly to unlock this keyword!",
        variant: "default"
      });
      return;
    }

    if (!selectedCell) {
      toast({ title: "Select a cell first", variant: "default" });
      return;
    }

    const { row, col } = selectedCell;
    if (grid[row][col].isFixed) return;

    const isValid = validatePlacement(row, col, symbol);

    const newGrid = [...grid];
    newGrid[row][col] = {
      ...newGrid[row][col],
      value: symbol,
      isCorrect: isValid,
    };
    setGrid(newGrid);

    if (!isValid) {
      setMistakes(prev => prev + 1);
      toast({ title: "❌ Invalid placement!", description: "This keyword violates Sudoku rules", variant: "destructive" });
    } else {
      toast({ title: "✅ Correct!", variant: "default", className: "bg-green-50 border-green-200 text-green-800" });
      checkCompletion(newGrid);
    }
  };

  const validatePlacement = (row: number, col: number, symbol: string): boolean => {
    for (let c = 0; c < gridSize; c++) {
      if (c !== col && grid[row][c].value === symbol) return false;
    }

    for (let r = 0; r < gridSize; r++) {
      if (r !== row && grid[r][col].value === symbol) return false;
    }

    const boxSize = gridSize === 6 ? 2 : 3;
    const boxRow = Math.floor(row / boxSize) * boxSize;
    const boxCol = Math.floor(col / boxSize) * boxSize;
    for (let r = boxRow; r < boxRow + boxSize; r++) {
      for (let c = boxCol; c < boxCol + boxSize; c++) {
        if ((r !== row || c !== col) && grid[r][c].value === symbol) return false;
      }
    }

    return true;
  };

  const checkCompletion = (currentGrid: SudokuCell[][]) => {
    let filledCells = 0;
    let totalCells = gridSize * gridSize;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (currentGrid[r][c].value && currentGrid[r][c].isCorrect) filledCells++;
      }
    }

    if (filledCells === totalCells) {
      setIsComplete(true);
      toast({
        title: "🎉 Puzzle Complete!",
        description: `You solved the ${gridSize}x${gridSize} Code Sudoku with ${mistakes} mistakes!`,
        className: "bg-green-50 border-green-200 text-green-800"
      });
    }
  };

  const progress = useMemo(() => {
    let filled = 0;
    let total = gridSize * gridSize;
    grid.forEach(row => row.forEach(cell => {
      if (cell.value && cell.isCorrect) filled++;
    }));
    return Math.round((filled / total) * 100);
  }, [grid, gridSize]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <GameHeader
        gameTitle="Code Sudoku"
        gameIcon="📊"
        team={team}
        room={room}
        extraInfo={
          <div className="flex gap-2">
            <Badge variant="outline" className="text-blue-200 border-blue-700 bg-blue-900/30">
              Progress: {progress}%
            </Badge>
            <Badge variant="outline" className="text-red-300 border-red-700 bg-red-900/30">
              Mistakes: {mistakes}
            </Badge>
          </div>
        }
      />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Questions & Hints */}
          <div className="lg:col-span-1 space-y-6">
            {/* Questions Panel */}
            <Card className="p-6 bg-slate-800/80 backdrop-blur border-slate-700 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl">
                  📝
                </div>
                <h2 className="text-xl font-bold text-white">Coding Challenge</h2>
              </div>

              {questions[currentQuestionIndex] ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-300">
                        Q{currentQuestionIndex + 1} / {questions.length}
                      </Badge>
                      <Badge variant="outline" className="text-green-400 border-green-500/30">
                        ✅ {solvedQuestions.length} Solved
                      </Badge>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                      <p className="text-slate-300 text-sm leading-relaxed">{questions[currentQuestionIndex].question_text}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !submitting && handleSubmitAnswer()}
                      placeholder="Type your answer..."
                      disabled={submitting}
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                    />

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSubmitAnswer}
                        disabled={submitting}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {submitting ? "Checking..." : "Submit"}
                      </Button>
                      {currentQuestionIndex < questions.length - 1 && (
                        <Button
                          onClick={() => {
                            setCurrentQuestionIndex(prev => prev + 1);
                            setAnswer("");
                          }}
                          variant="outline"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          Skip
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-4xl mb-2">🎉</div>
                  <p>All questions completed!</p>
                </div>
              )}
            </Card>

            {/* Hints Panel */}
            <Card className="p-6 bg-slate-800/80 backdrop-blur border-slate-700 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl">
                  💡
                </div>
                <h2 className="text-xl font-bold text-white">Hint Area</h2>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {availableHints.map((hint, index) => (
                  <button
                    key={index}
                    onClick={() => handleUseHint(hint)}
                    disabled={!hint.isUnlocked}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between ${hint.isUnlocked
                        ? "bg-green-900/20 border border-green-500/30 hover:bg-green-900/30 cursor-pointer"
                        : "bg-slate-900/40 border border-slate-700/30 opacity-60 cursor-not-allowed"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{hint.isUnlocked ? "🔓" : "🔒"}</span>
                      <span className={`font-semibold text-sm ${hint.isUnlocked ? "text-green-300" : "text-slate-500"}`}>
                        Hint #{index + 1}
                      </span>
                    </div>
                    {hint.isUnlocked && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 font-mono">
                        {hint.symbol} ({hint.row + 1}, {hint.col + 1})
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column: Grid & Keywords */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sudoku Grid */}
            <Card className="p-6 bg-slate-800/80 backdrop-blur border-slate-700 shadow-xl flex flex-col items-center">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-500/20 p-2 rounded-lg">
                  <span className="text-2xl">🎯</span>
                </div>
                <h2 className="text-xl font-bold text-white">9×9 Sudoku Grid</h2>
              </div>

              <div
                className="inline-grid gap-1 bg-slate-900 p-3 rounded-xl shadow-2xl border border-slate-700"
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
              >
                {grid.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold rounded transition-all duration-200 ${cell.isFixed
                          ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                          : selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                            ? "bg-blue-600 text-white ring-2 ring-blue-400 z-10 scale-110"
                            : cell.value
                              ? cell.isCorrect
                                ? "bg-green-900/40 text-green-300 border border-green-500/30"
                                : "bg-red-900/40 text-red-300 border border-red-500/30"
                              : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                        }`}
                    >
                      {cell.value || ""}
                    </button>
                  ))
                )}
              </div>
            </Card>

            {/* Keywords Selection */}
            <Card className="p-6 bg-slate-800/80 backdrop-blur border-slate-700 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-pink-500/20 p-2 rounded-lg">
                  <span className="text-2xl">⌨️</span>
                </div>
                <h2 className="text-xl font-bold text-white">Select Keyword</h2>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {symbols.map((symbol) => {
                  const isUnlocked = unlockedKeywords.includes(symbol);
                  return (
                    <button
                      key={symbol}
                      onClick={() => handleSymbolSelect(symbol)}
                      disabled={!isUnlocked}
                      className={`px-2 py-3 rounded-lg font-mono font-bold text-xs sm:text-sm transition-all ${isUnlocked
                          ? "bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg transform hover:scale-105"
                          : "bg-slate-900/50 text-slate-600 cursor-not-allowed border border-slate-800"
                        }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {!isUnlocked && <span className="text-xs">🔒</span>}
                        <span>{symbol}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.5); border-radius: 10px; }
      `}</style>
    </div>
  );
}
