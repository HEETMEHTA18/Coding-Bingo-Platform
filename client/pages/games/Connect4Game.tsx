// Code Connect-4 Game with Questions & Strategy Power-Ups
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import GameHeader from "../../components/GameHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

type Question = {
  id: string;
  question_id: number;
  question_text: string;
  is_real: boolean;
};

type Cell = "empty" | "player" | "bot";
type Board = Cell[][];

type PowerUp = {
  type: "hint" | "block";
  name: string;
  isUnlocked: boolean;
};

export default function Connect4Game() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  const ROWS = 6;
  const COLS = 7;

  // Game state
  const [board, setBoard] = useState<Board>(Array.from({ length: ROWS }, () => Array(COLS).fill("empty")));
  const [currentPlayer, setCurrentPlayer] = useState<"player" | "bot">("player");
  const [winner, setWinner] = useState<string | null>(null);
  const [winningCells, setWinningCells] = useState<[number, number][]>([]);
  const [moveCount, setMoveCount] = useState(0);

  // Questions system
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [solvedQuestions, setSolvedQuestions] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Power-ups system
  const [powerUps, setPowerUps] = useState<PowerUp[]>([
    { type: "hint", name: "Column Hint", isUnlocked: false },
    { type: "block", name: "Block Bot", isUnlocked: false },
  ]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [blocksUsed, setBlocksUsed] = useState(0);
  const [botBlocked, setBotBlocked] = useState(false);

  useEffect(() => {
    if (!team || !room) {
      navigate("/");
      return;
    }
    loadQuestions();
  }, [team, room, navigate]);

  useEffect(() => {
    if (currentPlayer === "bot" && !winner && !botBlocked) {
      setTimeout(() => botMove(), 800);
    }
  }, [currentPlayer, winner, botBlocked]);

  const loadQuestions = async () => {
    try {
      const teamId = team?.team_id || team?.id;
      const res = await fetch(`/api/game?room=${encodeURIComponent(room?.code || "")}&team=${encodeURIComponent(teamId || "")}`);
      if (!res.ok) return;

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
    } catch (error) {
      console.error("Error loading questions:", error);
    }
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

        // Unlock next power-up
        const nextUnlocked = powerUps.findIndex(p => !p.isUnlocked);
        if (nextUnlocked !== -1) {
          const newPowerUps = [...powerUps];
          newPowerUps[nextUnlocked] = { ...newPowerUps[nextUnlocked], isUnlocked: true };
          setPowerUps(newPowerUps);
          toast({
            title: "✅ Correct!",
            description: `Power-up "${newPowerUps[nextUnlocked].name}" unlocked!`,
            className: "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800"
          });
        } else {
          toast({
            title: "✅ Correct!",
            description: "All power-ups unlocked!",
            className: "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800"
          });
        }

        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setAnswer("");
        }
      } else {
        toast({ title: "❌ Incorrect", description: "Try again!", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      toast({ title: "Failed to submit answer", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const dropToken = (col: number) => {
    if (winner || currentPlayer !== "player") return;

    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row][col] === "empty") {
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = "player";
        setBoard(newBoard);
        setMoveCount(prev => prev + 1);

        if (checkWinner(newBoard, row, col, "player")) {
          setWinner("player");
          return;
        }

        if (checkDraw(newBoard)) {
          setWinner("draw");
          return;
        }

        setCurrentPlayer("bot");
        return;
      }
    }
  };

  const botMove = () => {
    const availableCols = [];
    for (let col = 0; col < COLS; col++) {
      if (board[0][col] === "empty") availableCols.push(col);
    }

    if (availableCols.length === 0) return;

    // Simple AI: Try to win, then block player, then random
    let col = -1;

    // 1. Check for winning move
    for (const c of availableCols) {
      // Simulate move
      const tempBoard = board.map(r => [...r]);
      let r = ROWS - 1;
      while (r >= 0 && tempBoard[r][c] !== "empty") r--;
      if (r >= 0) {
        tempBoard[r][c] = "bot";
        if (checkWinner(tempBoard, r, c, "bot")) {
          col = c;
          break;
        }
      }
    }

    // 2. Block player
    if (col === -1) {
      for (const c of availableCols) {
        const tempBoard = board.map(r => [...r]);
        let r = ROWS - 1;
        while (r >= 0 && tempBoard[r][c] !== "empty") r--;
        if (r >= 0) {
          tempBoard[r][c] = "player";
          if (checkWinner(tempBoard, r, c, "player")) {
            col = c;
            break;
          }
        }
      }
    }

    // 3. Random
    if (col === -1) {
      col = availableCols[Math.floor(Math.random() * availableCols.length)];
    }

    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row][col] === "empty") {
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = "bot";
        setBoard(newBoard);
        setMoveCount(prev => prev + 1);

        if (checkWinner(newBoard, row, col, "bot")) {
          setWinner("bot");
          return;
        }

        if (checkDraw(newBoard)) {
          setWinner("draw");
          return;
        }

        setCurrentPlayer("player");
        return;
      }
    }
  };

  const checkWinner = (board: Board, row: number, col: number, player: Cell): boolean => {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal \
      [1, -1],  // diagonal /
    ];

    for (const [dx, dy] of directions) {
      const cells: [number, number][] = [[row, col]];

      // Check positive direction
      for (let i = 1; i < 4; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS && board[newRow][newCol] === player) {
          cells.push([newRow, newCol]);
        } else break;
      }

      // Check negative direction
      for (let i = 1; i < 4; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS && board[newRow][newCol] === player) {
          cells.push([newRow, newCol]);
        } else break;
      }

      if (cells.length >= 4) {
        setWinningCells(cells);
        return true;
      }
    }

    return false;
  };

  const checkDraw = (board: Board): boolean => {
    return board[0].every(cell => cell !== "empty");
  };

  const handleUseHint = () => {
    const hintPowerUp = powerUps.find(p => p.type === "hint" && p.isUnlocked);
    if (!hintPowerUp) {
      toast({ title: "🔒 Locked", description: "Answer questions to unlock hints!", variant: "default" });
      return;
    }

    // Find best column (most player tokens in that column)
    let bestCol = -1;
    let maxCount = -1;

    for (let col = 0; col < COLS; col++) {
      if (board[0][col] !== "empty") continue;
      let count = 0;
      for (let row = 0; row < ROWS; row++) {
        if (board[row][col] === "player") count++;
      }
      if (count > maxCount) {
        maxCount = count;
        bestCol = col;
      }
    }

    if (bestCol !== -1) {
      toast({
        title: "💡 Hint!",
        description: `Try column ${bestCol + 1} - it has ${maxCount} of your tokens!`,
      });
      setHintsUsed(prev => prev + 1);
    } else {
      toast({ title: "💡 Hint!", description: "All columns are good options!" });
    }
  };

  const handleUseBlock = () => {
    const blockPowerUp = powerUps.find(p => p.type === "block" && p.isUnlocked);
    if (!blockPowerUp) {
      toast({ title: "🔒 Locked", description: "Answer questions to unlock block!", variant: "default" });
      return;
    }

    setBotBlocked(true);
    setBlocksUsed(prev => prev + 1);
    toast({ title: "🛡️ Bot Blocked!", description: "Bot's next turn will be skipped!" });

    setTimeout(() => {
      setBotBlocked(false);
      if (currentPlayer === "bot") setCurrentPlayer("player");
    }, 3000);
  };

  const resetGame = () => {
    setBoard(Array.from({ length: ROWS }, () => Array(COLS).fill("empty")));
    setCurrentPlayer("player");
    setWinner(null);
    setWinningCells([]);
    setMoveCount(0);
    setBotBlocked(false);
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <GameHeader
        gameTitle="Code Connect-4"
        gameIcon="🔴"
        team={team}
        room={room}
        extraInfo={
          <div className="flex gap-2">
            <Badge variant={currentPlayer === "player" ? "default" : "secondary"} className="text-sm py-1">
              {currentPlayer === "player" ? "🟢 Your Turn" : "🔴 Bot's Turn"}
            </Badge>
            <Badge variant="outline" className="text-sm py-1">
              Moves: {moveCount}
            </Badge>
          </div>
        }
      />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Questions & Power-ups */}
          <div className="lg:col-span-1 space-y-6">
            {/* Questions Panel */}
            <Card className="p-6 bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl">
                  📝
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Coding Challenge</h2>
              </div>

              {currentQuestion ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                        Question {currentQuestionIndex + 1} / {questions.length}
                      </Badge>
                      <Badge variant="outline" className="text-green-600 border-green-200 dark:text-green-400 dark:border-green-800">
                        ✅ {solvedQuestions.length} Solved
                      </Badge>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{currentQuestion.question_text}</p>
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
                      className="bg-white dark:bg-slate-950"
                    />

                    <Button
                      onClick={handleSubmitAnswer}
                      disabled={submitting}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                    >
                      {submitting ? "Checking..." : "Submit Answer"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <div className="text-4xl mb-2">🎉</div>
                  <p>All questions completed!</p>
                </div>
              )}
            </Card>

            {/* Power-ups Panel */}
            <Card className="p-6 bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xl">
                  ⚡
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Power-Ups</h2>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleUseHint}
                  disabled={!powerUps.find(p => p.type === "hint")?.isUnlocked}
                  className={`w-full justify-between h-auto py-4 ${powerUps.find(p => p.type === "hint")?.isUnlocked
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    }`}
                  variant="ghost"
                >
                  <span className="font-bold flex items-center gap-2">
                    💡 Column Hint
                  </span>
                  {!powerUps.find(p => p.type === "hint")?.isUnlocked && <span className="text-xs">🔒 Locked</span>}
                </Button>

                <Button
                  onClick={handleUseBlock}
                  disabled={!powerUps.find(p => p.type === "block")?.isUnlocked || botBlocked}
                  className={`w-full justify-between h-auto py-4 ${powerUps.find(p => p.type === "block")?.isUnlocked && !botBlocked
                      ? "bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-md"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    }`}
                  variant="ghost"
                >
                  <span className="font-bold flex items-center gap-2">
                    🛡️ Block Bot
                  </span>
                  {(!powerUps.find(p => p.type === "block")?.isUnlocked || botBlocked) && <span className="text-xs">🔒 Locked</span>}
                </Button>
              </div>

              <div className="mt-4 flex justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>Hints used: {hintsUsed}</span>
                <span>Blocks used: {blocksUsed}</span>
              </div>
            </Card>
          </div>

          {/* Right Column: Game Board */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-white dark:bg-slate-900 shadow-2xl border-slate-200 dark:border-slate-800 h-full flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 pointer-events-none" />

              <div className="relative z-10 w-full max-w-2xl">
                <div className="bg-blue-600 dark:bg-blue-800 p-4 rounded-2xl shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] border-4 border-blue-700 dark:border-blue-900">
                  <div className="grid grid-cols-7 gap-2 sm:gap-3 bg-blue-500 dark:bg-blue-700 p-2 sm:p-3 rounded-xl border-2 border-blue-400/30">
                    {board.map((row, rowIndex) =>
                      row.map((cell, colIndex) => {
                        const isWinning = winningCells.some(([r, c]) => r === rowIndex && c === colIndex);
                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            onClick={() => dropToken(colIndex)}
                            className={`aspect-square rounded-full relative overflow-hidden transition-all duration-300 ${cell === "empty"
                                ? "bg-blue-800/40 dark:bg-slate-900/40 cursor-pointer hover:bg-blue-700/40 inner-shadow"
                                : "shadow-lg"
                              }`}
                          >
                            {cell !== "empty" && (
                              <div className={`w-full h-full rounded-full transform transition-all duration-500 ${cell === "player"
                                  ? "bg-gradient-to-br from-yellow-300 to-yellow-500 border-4 border-yellow-400"
                                  : "bg-gradient-to-br from-red-400 to-red-600 border-4 border-red-500"
                                } ${isWinning ? "animate-pulse ring-4 ring-white/50 scale-105" : ""}`}>
                                <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-white/20 rounded-full blur-sm" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Turn Indicator / Winner Message */}
                <div className="mt-8 text-center">
                  {winner ? (
                    <div className="animate-in zoom-in duration-300 space-y-4">
                      <div className="text-5xl mb-2">
                        {winner === "player" ? "🎉" : winner === "bot" ? "🤖" : "🤝"}
                      </div>
                      <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {winner === "player" ? "You Won!" : winner === "bot" ? "Bot Won!" : "It's a Draw!"}
                      </h3>
                      <Button
                        onClick={resetGame}
                        size="lg"
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                      >
                        Play Again
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 text-lg font-medium text-slate-600 dark:text-slate-300">
                      <span>Current Turn:</span>
                      <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${currentPlayer === "player"
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                          : "bg-red-100 text-red-800 border border-red-200"
                        }`}>
                        <span className={`w-3 h-3 rounded-full ${currentPlayer === "player" ? "bg-yellow-500" : "bg-red-500"}`} />
                        {currentPlayer === "player" ? "You" : "Bot"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <style>{`
        .inner-shadow {
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
