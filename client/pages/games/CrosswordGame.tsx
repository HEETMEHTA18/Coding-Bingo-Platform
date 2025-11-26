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
  const [clueAnswer, setClueAnswer] = useState("");

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

  const handleClueSubmit = () => {
    const currentClue = clues[currentClueIndex];
    if (!currentClue) return;

    if (clueAnswer.toUpperCase().trim() === currentClue.answer) {
      setSolvedClues(prev => [...prev, currentClue.id]);
      setScore(prev => prev + 15);
      toast({
        title: "✅ Correct!",
        description: `Word: ${currentClue.answer}`,
        className: "bg-green-50 border-green-200 text-green-800"
      });

      if (currentClueIndex < clues.length - 1) {
        setCurrentClueIndex(prev => prev + 1);
        setClueAnswer("");
      } else {
        toast({
          title: "🎉 Crossword Complete!",
          description: `Final score: ${score + 15} points!`,
          className: "bg-purple-50 border-purple-200 text-purple-800"
        });
      }
    } else {
      toast({ title: "❌ Incorrect", description: "Try again!", variant: "destructive" });
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
        setScore(prev => prev + 10);
        toast({
          title: "✅ Correct!",
          description: "Bonus points earned!",
          className: "bg-green-50 border-green-200 text-green-800"
        });

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

  const currentClue = clues[currentClueIndex];
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-950 dark:via-amber-950/30 dark:to-yellow-950/30">
      <GameHeader
        gameTitle="Code Crossword"
        gameIcon="📝"
        team={team}
        room={room}
        showAchievements={false}
        showLeaderboard={true}
      />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4 text-center bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-lg border-amber-200 dark:border-amber-800">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Score</div>
            <div className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{score}</div>
          </Card>
          <Card className="p-4 text-center bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-lg border-green-200 dark:border-green-800">
            <div className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">Solved</div>
            <div className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{solvedClues.length}/{clues.length}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Game Interaction */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Clue Card */}
            {currentClue ? (
              <Card className="p-6 bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-9xl">✏️</span>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
                        {currentClue.id}
                      </div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Current Clue</h2>
                    </div>
                    <Badge variant={currentClue.direction === 'across' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                      {currentClue.direction.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                    <p className="text-xl text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      "{currentClue.clue}"
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-2">
                      <span>📏</span> Answer length: <span className="font-bold">{currentClue.answer.length} letters</span>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Input
                      value={clueAnswer}
                      onChange={(e) => setClueAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleClueSubmit()}
                      placeholder="Type the word..."
                      className="flex-1 text-lg uppercase tracking-widest font-mono bg-slate-50 dark:bg-slate-950 border-2 focus:border-amber-500 transition-all"
                      maxLength={currentClue.answer.length}
                    />
                    <Button
                      onClick={handleClueSubmit}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 shadow-md"
                    >
                      Submit
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center bg-white dark:bg-slate-900 shadow-xl">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Crossword Completed!</h2>
                <p className="text-slate-600 dark:text-slate-400">You've solved all the clues. Great job!</p>
              </Card>
            )}

            {/* Visual Grid Preview */}
            <Card className="p-6 bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span>🧩</span> Puzzle Progress
              </h3>
              <div className="flex flex-wrap gap-2">
                {clues.map(clue => (
                  <div
                    key={clue.id}
                    className={`h-12 px-4 rounded-lg flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${solvedClues.includes(clue.id)
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300 shadow-sm'
                        : clue.id === currentClue?.id
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-200 dark:ring-amber-800'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}
                  >
                    <span className="mr-2 opacity-50">#{clue.id}</span>
                    {solvedClues.includes(clue.id) ? clue.answer : "???"}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column: Bonus & List */}
          <div className="space-y-6">
            {/* Bonus Question */}
            {currentQuestion && (
              <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-200 dark:border-indigo-800 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                    <span>⭐</span> Bonus Question
                  </h2>
                  <Badge className="bg-indigo-500 hover:bg-indigo-600">+10 Pts</Badge>
                </div>

                <p className="text-sm text-indigo-800 dark:text-indigo-300 mb-4 leading-relaxed font-medium">
                  {currentQuestion.question_text}
                </p>

                <div className="space-y-2">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                    placeholder="Bonus answer..."
                    disabled={submitting}
                    className="bg-white/80 dark:bg-slate-900/80 border-indigo-200 dark:border-indigo-700"
                  />
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={submitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    size="sm"
                  >
                    {submitting ? "Checking..." : "Submit Bonus"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Clue List */}
            <Card className="p-6 bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800 max-h-[400px] overflow-y-auto custom-scrollbar">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 sticky top-0 bg-white dark:bg-slate-900 pb-2 border-b border-slate-100 dark:border-slate-800">
                All Clues
              </h3>
              <div className="space-y-3">
                {clues.map(clue => (
                  <div
                    key={clue.id}
                    className={`p-3 rounded-lg border transition-all ${solvedClues.includes(clue.id)
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50'
                        : clue.id === currentClue?.id
                          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${clue.direction === 'across'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            }`}>
                            {clue.id} {clue.direction === 'across' ? '→' : '↓'}
                          </span>
                          {solvedClues.includes(clue.id) && (
                            <span className="text-xs font-mono font-bold text-green-600 dark:text-green-400">
                              {clue.answer}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{clue.clue}</p>
                      </div>
                      {solvedClues.includes(clue.id) && (
                        <span className="text-green-500 text-lg">✓</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
