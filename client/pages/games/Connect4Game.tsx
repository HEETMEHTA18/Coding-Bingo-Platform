// Code Connect-4 Game with Questions & Strategy Power-Ups
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import GameHeader from "../../components/GameHeader";
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
          } catch {}
        } catch {}
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
          });
        } else {
          toast({ title: "✅ Correct!", description: "All power-ups unlocked!" });
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
    
    const col = availableCols[Math.floor(Math.random() * availableCols.length)];
    
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
    <div className="min-h-screen bg-[#0f172a]">
      <GameHeader
        gameTitle="Code Connect-4"
        gameIcon="🔴"
        team={team}
        room={room}
        extraInfo={
          <>
            <div className="px-3 sm:px-4 py-2 rounded-lg bg-blue-900/30 border border-blue-700 shadow-md">
              <span className="text-blue-200 font-semibold text-sm sm:text-base">
                {currentPlayer === "player" ? "🟢 Your Turn" : "🔴 Bot's Turn"}
              </span>
            </div>
            <div className="px-3 sm:px-4 py-2 rounded-lg bg-purple-900/30 border border-purple-700 shadow-md">
              <span className="text-purple-200 font-semibold text-sm sm:text-base">Moves: {moveCount}</span>
            </div>
          </>
        }
      />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Questions Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-blue-500/30 shadow-2xl shadow-blue-500/10 p-4 sm:p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-500/20 p-3 rounded-xl">
                  <span className="text-2xl">📝</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Coding Challenge</h2>
              </div>
              
              {currentQuestion ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs sm:text-sm font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">
                        Question {currentQuestionIndex + 1} / {questions.length}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
                        ✅ {solvedQuestions.length}
                      </span>
                    </div>
                    <div className="bg-slate-900/70 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50">
                      <p className="text-white text-sm sm:text-base">{currentQuestion.question_text}</p>
                    </div>
                  </div>
                  
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !submitting && handleSubmitAnswer()}
                    placeholder="Type your answer..."
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-slate-900/70 border-2 border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all text-sm"
                  />
                  
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={submitting}
                    className="w-full mt-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold disabled:opacity-50 transition-all text-sm"
                  >
                    {submitting ? "⏳ Submitting..." : "Submit Answer"}
                  </button>
                </>
              ) : (
                <div className="text-center py-4 text-slate-400">No questions available</div>
              )}
            </div>

            {/* Power-ups Panel */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/10 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-500/20 p-3 rounded-xl">
                  <span className="text-2xl">⚡</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Power-Ups</h2>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={handleUseHint}
                  disabled={!powerUps.find(p => p.type === "hint")?.isUnlocked}
                  className={`w-full p-4 rounded-xl transition-all ${
                    powerUps.find(p => p.type === "hint")?.isUnlocked
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 cursor-pointer"
                      : "bg-slate-800/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold">💡 Column Hint</span>
                    {!powerUps.find(p => p.type === "hint")?.isUnlocked && <span>🔒</span>}
                  </div>
                </button>
                
                <button
                  onClick={handleUseBlock}
                  disabled={!powerUps.find(p => p.type === "block")?.isUnlocked || botBlocked}
                  className={`w-full p-4 rounded-xl transition-all ${
                    powerUps.find(p => p.type === "block")?.isUnlocked && !botBlocked
                      ? "bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 cursor-pointer"
                      : "bg-slate-800/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold">🛡️ Block Bot</span>
                    {(!powerUps.find(p => p.type === "block")?.isUnlocked || botBlocked) && <span>🔒</span>}
                  </div>
                </button>
              </div>
              
              <div className="mt-4 text-xs text-slate-400 text-center">
                Used: Hints {hintsUsed} | Blocks {blocksUsed}
              </div>
            </div>
          </div>

          {/* Connect-4 Board */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-indigo-500/30 shadow-2xl shadow-indigo-500/10 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-500/20 p-3 rounded-xl">
                  <span className="text-2xl">🎯</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Connect-4 Board</h2>
              </div>

              <div className="bg-blue-900/30 rounded-xl p-4 border border-blue-700/50">
                <div className="grid grid-cols-7 gap-2">
                  {board.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const isWinning = winningCells.some(([r, c]) => r === rowIndex && c === colIndex);
                      return (
                        <button
                          key={`${rowIndex}-${colIndex}`}
                          onClick={() => dropToken(colIndex)}
                          disabled={currentPlayer !== "player" || winner !== null}
                          className={`aspect-square rounded-full transition-all transform hover:scale-110 ${
                            cell === "player"
                              ? isWinning
                                ? "bg-gradient-to-br from-green-400 to-green-600 animate-pulse shadow-lg shadow-green-500/50"
                                : "bg-gradient-to-br from-yellow-400 to-yellow-600"
                              : cell === "bot"
                                ? isWinning
                                  ? "bg-gradient-to-br from-red-400 to-red-600 animate-pulse shadow-lg shadow-red-500/50"
                                  : "bg-gradient-to-br from-red-500 to-red-700"
                                : "bg-slate-800/70 border-2 border-slate-700/50 hover:bg-slate-700/70 cursor-pointer"
                          }`}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {winner && (
                <div className="mt-6 p-6 bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-2 border-purple-500/50 rounded-xl text-center">
                  <div className="text-4xl mb-2">
                    {winner === "player" ? "🎉" : winner === "bot" ? "🤖" : "🤝"}
                  </div>
                  <h3 className="text-purple-200 font-bold text-xl mb-2">
                    {winner === "player" ? "You Win!" : winner === "bot" ? "Bot Wins!" : "It's a Draw!"}
                  </h3>
                  <p className="text-purple-300 text-sm mb-4">
                    Completed in {moveCount} moves
                  </p>
                  <button
                    onClick={resetGame}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold"
                  >
                    🎮 New Game
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
