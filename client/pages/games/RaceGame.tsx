// Code Race (Debug) Game
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GameTimer from "../../components/GameTimer";
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

type BugSnippet = {
  id: number;
  code: string;
  bug: string;
  line: number;
};

export default function RaceGame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const [bugSnippets] = useState<BugSnippet[]>([
    { id: 1, code: 'for (let i = 0; i <= 10; i++)', bug: 'Off-by-one error', line: 1 },
    { id: 2, code: 'if (x = 5)', bug: 'Assignment instead of comparison', line: 1 },
    { id: 3, code: 'console.log("Hello World)', bug: 'Missing closing quote', line: 1 },
    { id: 4, code: 'let array = [1, 2, 3]; array[3]', bug: 'Array index out of bounds', line: 2 },
    { id: 5, code: 'function add(a, b) { return a + b } add(5)', bug: 'Missing argument', line: 1 },
  ]);
  const [currentBugIndex, setCurrentBugIndex] = useState(0);

  useEffect(() => {
    if (!team || !room) {
      navigate("/");
      return;
    }
    loadQuestions();
  }, [team, room, navigate]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted]);

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

  const handleStartGame = () => {
    setGameStarted(true);
    setTimeElapsed(0);
    setScore(0);
    setCurrentBugIndex(0);
    setCurrentQuestionIndex(0);
  };

  const handleBugAnswer = (bugId: number) => {
    const currentBug = bugSnippets[currentBugIndex];
    if (bugId === currentBug.id) {
      setScore(prev => prev + 10);
      toast({
        title: "✅ Correct!",
        description: `Bug found: ${currentBug.bug}`,
        className: "bg-green-50 border-green-200 text-green-800"
      });

      if (currentBugIndex < bugSnippets.length - 1) {
        setCurrentBugIndex(prev => prev + 1);
      } else {
        toast({
          title: "🏁 Race Complete!",
          description: `You finished in ${timeElapsed}s with ${score + 10} points!`,
          className: "bg-blue-50 border-blue-200 text-blue-800"
        });
        setGameStarted(false);
      }
    } else {
      toast({ title: "❌ Wrong bug", description: "Keep looking!", variant: "destructive" });
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
        <GameHeader
          gameTitle="Code Race (Debug)"
          gameIcon="🏁"
          team={team}
          room={room}
          showAchievements={false}
          showLeaderboard={true}
          extraInfo={<GameTimer time={timeElapsed} type="elapsed" />}
        />

        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <Card className="p-8 sm:p-12 text-center max-w-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="text-6xl sm:text-8xl mb-6 animate-bounce">🏁</div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">Code Race (Debug)</h1>
            <div className="space-y-4 mb-8">
              <p className="text-lg sm:text-xl text-slate-700 dark:text-slate-300">
                Find and fix bugs as fast as you can!
              </p>
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-6 mt-4 text-left border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-xl">📋</span> How to Play:
                </p>
                <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    Review buggy code snippets
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    Identify the bug type
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    Click the correct bug to score points
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    Answer bonus questions for extra points
                  </li>
                </ul>
              </div>
            </div>
            <Button
              onClick={handleStartGame}
              size="lg"
              className="text-lg px-12 py-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/20 font-bold transition-all transform hover:scale-105"
            >
              🚀 Start Race
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const currentBug = bugSnippets[currentBugIndex];
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <GameHeader
        gameTitle="Code Race (Debug)"
        gameIcon="🏁"
        team={team}
        room={room}
        showAchievements={false}
        showLeaderboard={true}
        hideRoomTimer={true}
        extraInfo={<GameTimer time={timeElapsed} type="elapsed" />}
      />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Stats Bar */}
        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="p-4 text-center bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-lg border-green-200 dark:border-green-800">
            <div className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">Score</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{score}</div>
          </Card>
          <Card className="p-4 text-center bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-lg border-purple-200 dark:border-purple-800">
            <div className="text-sm font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Bug</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{currentBugIndex + 1}/{bugSnippets.length}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🐛</span> Find the Bug
                </h2>
                <Badge variant="destructive" className="animate-pulse">Bug #{currentBugIndex + 1}</Badge>
              </div>

              <div className="bg-slate-950 rounded-xl p-6 mb-6 font-mono text-sm sm:text-base border border-slate-800 shadow-inner relative group">
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 group-hover:bg-red-500 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 group-hover:bg-yellow-500 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 group-hover:bg-green-500 transition-colors" />
                </div>
                <code className="text-green-400 block leading-relaxed pt-4">{currentBug.code}</code>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {['Off-by-one error', 'Assignment instead of comparison', 'Missing closing quote',
                  'Array index out of bounds', 'Missing argument', 'Syntax error'].map((bugType, idx) => (
                    <Button
                      key={idx}
                      onClick={() => handleBugAnswer(bugSnippets.find(b => b.bug === bugType)?.id || 0)}
                      variant="outline"
                      className="justify-start text-left h-auto py-4 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                    >
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs mr-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        {bugType}
                      </span>
                    </Button>
                  ))}
              </div>
            </Card>
          </div>

          {/* Bonus Question */}
          <div className="space-y-6">
            {currentQuestion && (
              <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-200 dark:border-yellow-800 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-yellow-900 dark:text-yellow-200 flex items-center gap-2">
                    <span>⭐</span> Bonus Question
                  </h2>
                  <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-none shadow-sm">+10 Pts</Badge>
                </div>

                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-4 leading-relaxed font-medium">
                  {currentQuestion.question_text}
                </p>

                <div className="space-y-3">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                    placeholder="Type your answer..."
                    disabled={submitting}
                    className="bg-white/80 dark:bg-slate-900/80 border-yellow-200 dark:border-yellow-700 focus:ring-yellow-500"
                  />
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={submitting}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm font-bold"
                  >
                    {submitting ? "Checking..." : "Submit Bonus"}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
