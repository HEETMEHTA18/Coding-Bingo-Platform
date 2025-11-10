// Code Sudoku Game Component with Questions & Hints
import { useEffect, useState, useMemo } from "react";
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

type SudokuCell = {
  value: string | null;
  isFixed: boolean;
  isCorrect: boolean;
  row: number;
  col: number;
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
      // Map API questions to local Question type
      const mappedQuestions: Question[] = data.questions.map(q => ({
        id: q.id,
        question_id: q.question_id || 0,
        question_text: q.question_text || q.text,
        is_real: q.is_real ?? true,
      }));
      setQuestions(mappedQuestions);
    }
  };

  // Initialize grid with some fixed cells
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

        // Add empty cells as potential hints
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
    setAvailableHints(hints.slice(0, 15)); // Max 15 hints available
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
          // API expects `room` field (not roomCode) and string ids
          room: room?.code,
          teamId: String(teamId),
          questionId: String(currentQuestion.id),
          answer: answer,
        }),
      });

      // If server returns non-2xx, try to extract error message
      if (!res.ok) {
        let errMsg = `Submit failed: ${res.status}`;
        try {
          const body = await res.text();
          // try parse json
          try {
            const j = JSON.parse(body);
            if (j && j.error) errMsg = `${errMsg} - ${j.error}`;
            else if (j && j.message) errMsg = `${errMsg} - ${j.message}`;
          } catch {
            if (body) errMsg = `${errMsg} - ${body}`;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const result = await res.json();
      
      if (result.correct) {
        // Mark question as solved
        setSolvedQuestions(prev => [...prev, currentQuestionIndex]);
        
        // Unlock next keyword
        const nextKeywordIndex = unlockedKeywords.length;
        if (nextKeywordIndex < symbols.length) {
          const newKeyword = symbols[nextKeywordIndex];
          setUnlockedKeywords(prev => [...prev, newKeyword]);
          toast({ 
            title: "✅ Correct!", 
            description: `Keyword "${newKeyword}" unlocked!`,
          });
        } else {
          toast({ 
            title: "✅ Correct!", 
            description: "All keywords already unlocked!",
          });
        }
        
        // Also unlock a hint
        const nextHintIndex = hintsUnlocked;
        if (nextHintIndex < availableHints.length) {
          const newHints = [...availableHints];
          newHints[nextHintIndex] = { ...newHints[nextHintIndex], isUnlocked: true };
          setAvailableHints(newHints);
          setHintsUnlocked(prev => prev + 1);
        }
        
        // Move to next question
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
    // Check if keyword is unlocked
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

    // Validate placement
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
      toast({ title: "✅ Correct!", variant: "default" });
      checkCompletion(newGrid);
    }
  };

  const validatePlacement = (row: number, col: number, symbol: string): boolean => {
    // Check row
    for (let c = 0; c < gridSize; c++) {
      if (c !== col && grid[row][c].value === symbol) return false;
    }

    // Check column
    for (let r = 0; r < gridSize; r++) {
      if (r !== row && grid[r][col].value === symbol) return false;
    }

    // Check sub-grid
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
    <div className="min-h-screen bg-[#0f172a]">
      {/* Header */}
      <GameHeader
        gameTitle="Code Sudoku with Questions"
        gameIcon="📊"
        team={team}
        room={room}
        extraInfo={
          <>
            <div className="px-3 sm:px-4 py-2 rounded-lg bg-blue-900/30 border border-blue-700 shadow-md">
              <span className="text-blue-200 font-semibold text-sm sm:text-base">Progress: {progress}%</span>
            </div>
            <div className="px-3 sm:px-4 py-2 rounded-lg bg-pink-900/30 border border-pink-700 shadow-md">
              <span className="text-pink-200 font-semibold text-sm sm:text-base">Keywords: {unlockedKeywords.length}/{symbols.length}</span>
            </div>
            <div className="px-3 sm:px-4 py-2 rounded-lg bg-purple-900/30 border border-purple-700 shadow-md">
              <span className="text-purple-200 font-semibold text-sm sm:text-base">Hints: {hintsUnlocked}/{availableHints.length}</span>
            </div>
            <div className="px-3 sm:px-4 py-2 rounded-lg bg-red-900/30 border border-red-700 shadow-md">
              <span className="text-red-300 font-semibold text-sm sm:text-base">Mistakes: {mistakes}</span>
            </div>
          </>
        }
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Questions Panel */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            {/* Question Card */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-blue-500/30 shadow-2xl shadow-blue-500/10 p-4 sm:p-6 transition-all duration-300 hover:border-blue-500/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-500/20 p-3 rounded-xl">
                  <span className="text-2xl">📝</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Coding Challenge</h2>
              </div>
              
              {questions[currentQuestionIndex] ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs sm:text-sm font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">
                        Question {currentQuestionIndex + 1} / {questions.length}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
                        ✅ {solvedQuestions.length} Solved
                      </span>
                    </div>
                    <div className="bg-slate-900/70 backdrop-blur-sm p-4 sm:p-5 rounded-xl border border-slate-700/50 shadow-lg">
                      <p className="text-white text-sm sm:text-base leading-relaxed">{questions[currentQuestionIndex].question_text}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && !submitting && handleSubmitAnswer()}
                      placeholder="Type your answer..."
                      disabled={submitting}
                      className="w-full px-4 py-3 bg-slate-900/70 backdrop-blur-sm border-2 border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all text-sm sm:text-base"
                    />
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={submitting}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/30 text-sm sm:text-base"
                      >
                        {submitting ? "⏳ Submitting..." : "Submit Answer"}
                      </button>
                      {currentQuestionIndex < questions.length - 1 && (
                        <button
                          onClick={() => {
                            setCurrentQuestionIndex(prev => prev + 1);
                            setAnswer("");
                          }}
                          disabled={submitting}
                          className="px-4 py-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 text-white disabled:opacity-50 transition-all text-sm sm:text-base border border-slate-600/50"
                        >
                          Skip ⏭️
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-slate-400">No questions available</p>
                </div>
              )}
            </div>

            {/* Hints Panel */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/10 p-4 sm:p-6 transition-all duration-300 hover:border-purple-500/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-500/20 p-3 rounded-xl">
                  <span className="text-2xl">💡</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Hint Area</h2>
              </div>
              
              <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <p className="text-xs sm:text-sm text-purple-200 text-center">
                  🎯 Answer questions to unlock powerful hints and select any keyword from the keyword section!
                </p>
              </div>
              
              <div className="space-y-2 max-h-[300px] sm:max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {availableHints.map((hint, index) => (
                  <button
                    key={index}
                    onClick={() => handleUseHint(hint)}
                    disabled={!hint.isUnlocked}
                    className={`w-full p-3 sm:p-4 rounded-xl text-left transition-all transform ${
                      hint.isUnlocked
                        ? "bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-2 border-green-500/50 hover:border-green-400 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-green-500/20"
                        : "bg-slate-900/40 border-2 border-slate-700/30 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg sm:text-xl">
                          {hint.isUnlocked ? "🔓" : "🔒"}
                        </span>
                        <span className={`font-semibold text-sm sm:text-base ${hint.isUnlocked ? "text-green-200" : "text-slate-500"}`}>
                          Hint #{index + 1}
                        </span>
                      </div>
                      {hint.isUnlocked && (
                        <div className="flex items-center gap-2 bg-green-500/20 px-2 sm:px-3 py-1 rounded-lg border border-green-500/30">
                          <span className="text-xs sm:text-sm font-mono font-bold text-green-300">
                            {hint.symbol}
                          </span>
                          <span className="text-[10px] sm:text-xs text-green-400">
                            ({hint.row + 1}, {hint.col + 1})
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sudoku Grid & Symbol Selection */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Sudoku Grid */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-indigo-500/30 shadow-2xl shadow-indigo-500/10 p-4 sm:p-6 transition-all duration-300 hover:border-indigo-500/50">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="bg-indigo-500/20 p-3 rounded-xl">
                  <span className="text-2xl">🎯</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">9×9 Sudoku Grid</h2>
              </div>
              
              <div className="flex justify-center">
                <div 
                  className="inline-grid gap-0.5 sm:gap-1 bg-slate-800/50 p-2 sm:p-3 rounded-xl shadow-2xl backdrop-blur-sm border border-slate-700/50"
                  style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
                >
                  {grid.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                      <button
                        key={`${rowIndex}-${colIndex}`}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                        className={`w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center text-[10px] sm:text-sm font-mono font-bold rounded transition-all duration-200 ${
                          cell.isFixed
                            ? "bg-slate-700/80 text-slate-300 cursor-not-allowed border-2 border-slate-600/50"
                            : selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white border-2 border-blue-400 shadow-lg shadow-blue-500/50 scale-110 z-10"
                              : cell.value
                                ? cell.isCorrect
                                  ? "bg-gradient-to-br from-green-600/40 to-emerald-600/40 text-green-200 border-2 border-green-500/50 hover:border-green-400 hover:scale-105"
                                  : "bg-gradient-to-br from-red-600/40 to-rose-600/40 text-red-200 border-2 border-red-500/50 hover:border-red-400"
                                : "bg-slate-900/70 text-slate-400 border-2 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 hover:scale-105"
                        }`}
                      >
                        {cell.value || ""}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Symbol Selection Panel */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-pink-500/30 shadow-2xl shadow-pink-500/10 p-4 sm:p-6 transition-all duration-300 hover:border-pink-500/50">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="bg-pink-500/20 p-3 rounded-xl">
                  <span className="text-2xl">⌨️</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Select Keyword</h2>
              </div>
              
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {symbols.map((symbol) => {
                  const isUnlocked = unlockedKeywords.includes(symbol);
                  return (
                    <button
                      key={symbol}
                      onClick={() => handleSymbolSelect(symbol)}
                      disabled={!isUnlocked}
                      className={`px-3 sm:px-6 py-3 sm:py-4 rounded-xl font-mono font-bold text-sm sm:text-lg transition-all transform ${
                        isUnlocked
                          ? "bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white hover:scale-105 active:scale-95 shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 cursor-pointer"
                          : "bg-slate-800/50 text-slate-600 cursor-not-allowed opacity-50 border-2 border-slate-700/30"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {!isUnlocked && <span className="text-sm">🔒</span>}
                        <span>{symbol}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-4 sm:mt-6 p-4 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border-2 border-blue-500/30 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📖</span>
                  <h3 className="text-blue-200 font-bold text-sm sm:text-base">Game Rules</h3>
                </div>
                <ul className="text-xs sm:text-sm text-blue-300 space-y-1.5 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Each row must contain all keywords exactly once</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Each column must contain all keywords exactly once</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Each 3×3 box must contain all keywords exactly once</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 font-bold">✓</span>
                    <span>Answer questions to unlock hints</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">💡</span>
                    <span>Use hints to reveal correct cell values</span>
                  </li>
                </ul>
              </div>

              {isComplete && (
                <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-2 border-green-500/50 rounded-xl backdrop-blur-sm shadow-2xl shadow-green-500/20">
                  <div className="text-center mb-4">
                    <div className="text-4xl sm:text-5xl mb-2 animate-bounce">🎉</div>
                    <h3 className="text-green-200 font-bold text-lg sm:text-xl mb-2">Puzzle Complete!</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-center">
                      <div className="text-red-400 text-xs sm:text-sm font-semibold mb-1">Mistakes</div>
                      <div className="text-red-200 text-xl sm:text-2xl font-bold">{mistakes}</div>
                    </div>
                    <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-3 text-center">
                      <div className="text-purple-400 text-xs sm:text-sm font-semibold mb-1">Hints Used</div>
                      <div className="text-purple-200 text-xl sm:text-2xl font-bold">{hintsUsed}</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      initializeGrid();
                      setIsComplete(false);
                      setMistakes(0);
                      setHintsUsed(0);
                      setCurrentQuestionIndex(0);
                      setSolvedQuestions([]);
                      setHintsUnlocked(0);
                      setUnlockedKeywords([]);
                      setAnswer("");
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-green-500/30 text-sm sm:text-base"
                  >
                    🎮 New Puzzle
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>
    </div>
  );
}
