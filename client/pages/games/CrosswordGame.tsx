// Code Crossword Game
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type CrosswordClue = {
  id: number;
  clue: string;
  answer: string;
  direction: 'across' | 'down';
  startRow: number;
  startCol: number;
};

export default function CrosswordGame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  // Game state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);

  // Crossword clues
  const [clues] = useState<CrosswordClue[]>([
    { id: 1, clue: 'A loop that repeats a block of code', answer: 'FOR', direction: 'across', startRow: 0, startCol: 0 },
    { id: 2, clue: 'Data structure with key-value pairs', answer: 'MAP', direction: 'down', startRow: 0, startCol: 2 },
    { id: 3, clue: 'Conditional statement', answer: 'IF', direction: 'across', startRow: 2, startCol: 1 },
    { id: 4, clue: 'Function that calls itself', answer: 'RECURSION', direction: 'across', startRow: 4, startCol: 0 },
    { id: 5, clue: 'Object blueprint in OOP', answer: 'CLASS', direction: 'down', startRow: 0, startCol: 0 },
  ]);
  const [solvedClues, setSolvedClues] = useState<number[]>([]);
  const [currentClueIndex, setCurrentClueIndex] = useState(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Determine grid size
  const gridSize = 12;

  // Generate grid state
  const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

  // Helper to place words on the grid
  clues.forEach(clue => {
    const { startRow, startCol, direction, answer, id } = clue;
    for (let i = 0; i < answer.length; i++) {
      const r = direction === 'across' ? startRow : startRow + i;
      const c = direction === 'across' ? startCol + i : startCol;
      if (r < gridSize && c < gridSize) {
        grid[r][c] = {
          char: answer[i],
          clueId: id,
          isStart: i === 0,
          active: solvedClues.includes(id)
        };
      }
    }
  });

  useEffect(() => {
    if (!team || !room) {
      navigate("/");
      return;
    }
    loadQuestions();
  }, [team, room, navigate]);

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

  const handleCellClick = (r: number, c: number) => {
    // Find clue associated with this cell
    const foundClue = clues.find(clue => {
      const { startRow, startCol, direction, answer } = clue;
      if (direction === 'across') {
        return r === startRow && c >= startCol && c < startCol + answer.length;
      } else {
        return c === startCol && r >= startRow && r < startRow + answer.length;
      }
    });

    if (foundClue) {
      const index = clues.indexOf(foundClue);
      setCurrentClueIndex(index);
      setCurrentQuestionIndex(index); // Assuming 1-to-1 mapping logic for now
      setAnswer("");
      setStatus(null);
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
          questionId: String(currentQuestion.question_id),
          answer: answer,
        }),
      });

      if (!res.ok) {
        throw new Error(`Submit failed: ${res.status}`);
      }

      const result = await res.json();

      if (result.correct) {
        // Mark clue as solved
        const currentClue = clues[currentClueIndex];
        if (currentClue && !solvedClues.includes(currentClue.id)) {
          setSolvedClues(prev => [...prev, currentClue.id]);
          setScore(prev => prev + 15);
          toast({
            title: "🎉 Clue Solved!",
            description: `You unlocked: ${currentClue.answer}`,
            className: "bg-green-50 border-green-200 text-green-800"
          });
          // Auto advance or just let them stay? Let them stay for now.
        }
        setStatus({ type: 'success', text: 'Correct!' });
      } else {
        toast({ title: "❌ Incorrect", description: "Try again!", variant: "destructive" });
        setStatus({ type: 'error', text: 'Incorrect Answer' });
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      toast({ title: "Failed to submit answer", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const currentClue = clues[currentClueIndex];
  const currentQuestion = questions[currentQuestionIndex];
  const isSolved = currentClue && solvedClues.includes(currentClue.id);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans">
      <GameHeader
        gameTitle="Code Crossword"
        gameIcon="🧩"
        team={team}
        room={room}
        showAchievements={false}
        showLeaderboard={true}
      />

      <div className="container mx-auto px-6 py-8 h-[calc(100vh-80px)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-8 h-full">

          {/* Left Column: The Crossword Grid (Canvas-like) */}
          <Card className="bg-[#1e293b]/50 border-slate-800 p-8 flex items-center justify-center overflow-auto shadow-2xl relative">
            <div className="relative bg-[#0f172a] p-4 rounded-xl border border-slate-700 shadow-inner">
              {/* Grid Rendering */}
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(40px, 1fr))` }}
              >
                {grid.map((row, r) => (
                  row.map((cell: any, c: number) => {
                    const isActiveClue = currentClue && cell?.clueId === currentClue.id;
                    const isCellSolved = cell && solvedClues.includes(cell.clueId);

                    return (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => cell && handleCellClick(r, c)}
                        className={`
                                        w-10 h-10 flex items-center justify-center text-lg font-bold rounded-md border-2 transition-all cursor-pointer relative
                                        ${cell
                            ? isCellSolved
                              ? 'bg-green-500/20 border-green-500/50 text-green-400'
                              : isActiveClue
                                ? 'bg-blue-500/20 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10 scale-110'
                                : 'bg-slate-800 border-slate-600 text-transparent hover:border-slate-400'
                            : 'border-transparent opacity-0 pointer-events-none'
                          }
                                    `}
                      >
                        {cell?.isStart && (
                          <span className="absolute top-0.5 left-1 text-[8px] font-normal opacity-70">
                            {cell.clueId}
                          </span>
                        )}
                        {isCellSolved ? cell.char : ''}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            {/* Legend / Instructions */}
            <div className="absolute bottom-6 left-6 text-sm text-slate-400 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-800 backdrop-blur">
              Click a word box to solve its coding challenge
            </div>
          </Card>


          {/* Right Column: Interaction Panel */}
          <div className="flex flex-col gap-6 h-full overflow-hidden">

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Score</div>
                <div className="text-3xl font-bold text-white">{score}</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Progress</div>
                <div className="text-3xl font-bold text-white">{solvedClues.length}/{clues.length}</div>
              </div>
            </div>

            {/* Active Challenge Panel */}
            <Card className="flex-1 bg-[#1e293b] border-slate-800 p-0 overflow-hidden flex flex-col shadow-xl">
              {currentClue ? (
                <>
                  <div className="p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                        {currentClue.direction.toUpperCase()}
                      </Badge>
                      {isSolved && <Badge className="bg-green-500 text-white">SOLVED</Badge>}
                    </div>
                    <h2 className="text-xl font-bold text-white leading-tight">
                      {currentClue.clue}
                    </h2>
                    <div className="mt-4 flex gap-1">
                      {Array.from({ length: currentClue.answer.length }).map((_, i) => (
                        <div key={i} className={`w-8 h-8 rounded border-b-2 flex items-center justify-center font-bold ${isSolved ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-slate-600 bg-slate-800 q-mark'}`}>
                          {isSolved ? currentClue.answer[i] : '?'}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span>⚡</span> Coding Challenge
                    </h3>

                    {isSolved ? (
                      <div className="text-center py-10">
                        <div className="text-5xl mb-4">✅</div>
                        <p className="text-slate-300 font-medium">You've solved this word!</p>
                        <p className="text-slate-500 text-sm mt-2">Select another word on the grid to continue.</p>
                      </div>
                    ) : (
                      currentQuestion && (
                        <div className="space-y-6">
                          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm text-blue-300 leading-relaxed overflow-x-auto">
                            {currentQuestion.question_text}
                          </div>

                          <div className="space-y-3">
                            <label className="text-sm text-slate-400">Enter output:</label>
                            <Input
                              value={answer}
                              onChange={(e) => setAnswer(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && !submitting && handleSubmitAnswer()}
                              placeholder="Code output..."
                              className="bg-slate-900 border-slate-700 h-11 font-mono"
                              autoFocus
                            />
                            <Button
                              onClick={handleSubmitAnswer}
                              disabled={submitting || !answer.trim()}
                              className="w-full bg-blue-600 hover:bg-blue-700 h-11"
                            >
                              {submitting ? "Verifying..." : "Unlock Word"}
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <span className="text-4xl mb-4 opacity-50">👈</span>
                  <p>Select a word on the grid to start solving</p>
                </div>
              )}
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
