// Code Canvas Game - Write code to draw patterns on a grid
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import GameHeader from "../../components/GameHeader";
import { executeCode, comparePatterns, calculateMatchPercentage, DEFAULT_CODE_TEMPLATE } from "@/lib/codeExecutor";
import { CODE_CANVAS_CHALLENGES, getChallengeById } from "@shared/codeCanvasChallenges";
import type { Team, Room, GameStateResponse } from "@shared/api";

type Language = 'javascript' | 'c' | 'cpp';

const LANGUAGE_TEMPLATES = {
  javascript: DEFAULT_CODE_TEMPLATE,
  c: `#include <stdio.h>

// Define generatePattern function that returns coordinates
// Format: coordinates[i][0] = x, coordinates[i][1] = y
int generatePattern(int coordinates[][2]) {
  int count = 0;
  
  // Your code here - add coordinates to array
  // Example: coordinates[count][0] = x; coordinates[count][1] = y; count++;
  
  return count; // Return number of coordinates
}`,
  cpp: `#include <iostream>
#include <vector>
using namespace std;

// Define generatePattern function that returns vector of coordinates
vector<pair<int, int>> generatePattern() {
  vector<pair<int, int>> result;
  
  // Your code here - add coordinates
  // Example: result.push_back({x, y});
  
  return result;
}`
};

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

export default function CodeCanvasGame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));
  const editorRef = useRef<any>(null);

  const [code, setCode] = useState(DEFAULT_CODE_TEMPLATE);
  const [language, setLanguage] = useState<Language>('javascript');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [userGrid, setUserGrid] = useState<Set<string>>(new Set());
  const [isExecuting, setIsExecuting] = useState(false);
  const [score, setScore] = useState(0);
  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentChallenge = getChallengeById(currentLevel);

  useEffect(() => {
    if (!team || !room) {
      navigate("/");
      return;
    }
    // Load questions but don't crash if API fails (Code Canvas works without it)
    loadQuestions().catch(err => {
      console.warn('Failed to load questions for Code Canvas, continuing without them:', err);
    });
  }, [team, room, navigate]);

  useEffect(() => {
    if (currentChallenge) {
      setCode(LANGUAGE_TEMPLATES[language]);
      setUserGrid(new Set());
    }
  }, [currentLevel, language, currentChallenge]);

  useEffect(() => {
    // Auto-save code to localStorage
    const timer = setTimeout(() => {
      localStorage.setItem(`codecanvas_code_${currentLevel}_${language}`, code);
    }, 1000);
    return () => clearTimeout(timer);
  }, [code, currentLevel, language]);

  const loadQuestions = async () => {
    try {
      const teamId = team?.team_id || team?.id;
      if (!teamId || !room?.code) {
        console.log('Code Canvas: No team/room data yet, skipping question load');
        return;
      }

      const res = await fetch(`/api/game?room=${encodeURIComponent(room.code)}&team=${encodeURIComponent(teamId)}`);
      if (!res.ok) {
        console.log('Code Canvas: Questions API returned non-OK status, continuing without questions');
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
    } catch (error) {
      // Network errors are non-fatal for Code Canvas game
      console.warn("Code Canvas: Failed to load questions (game will work without them):", error);
      throw error; // Re-throw so the useEffect catch handler can suppress it
    }
  };

  const handleRunCode = async () => {
    if (!currentChallenge) {
      toast({
        title: "Error",
        description: "No challenge loaded",
        variant: "destructive"
      });
      return;
    }

    setIsExecuting(true);

    try {
      const result = await executeCode(code);

      // Enhanced debug logging - show full result object
      console.log('=== CODE EXECUTION DEBUG ===');
      console.log('Raw result:', result);
      console.log('Result JSON:', JSON.stringify(result, null, 2));
      console.log('Success:', result.success);
      console.log('Has error:', !!result.error);
      console.log('Error value:', result.error);
      console.log('Has coordinates:', !!result.coordinates);
      console.log('Coordinates length:', result.coordinates?.length);
      console.log('===========================');

      if (result.success && result.coordinates) {
        // Check if coordinates array is empty
        if (result.coordinates.length === 0) {
          toast({
            title: "⚠️ Empty Result",
            description: "Your code runs but returns no coordinates. Add some logic to draw the pattern!",
            variant: "default"
          });
          setIsExecuting(false);
          return;
        }

        const coordSet = new Set(result.coordinates.map(([x, y]) => `${x},${y}`));
        setUserGrid(coordSet);

        const matchPercentage = calculateMatchPercentage(result.coordinates, currentChallenge.targetPattern);
        const isComplete = comparePatterns(result.coordinates, currentChallenge.targetPattern);

        if (isComplete) {
          setScore(prev => prev + currentChallenge.points);
          setCompletedLevels(prev => [...prev, currentLevel]);
          setShowSuccessAnimation(true);

          toast({
            title: "🎉 Perfect Match!",
            description: `Level ${currentLevel} complete! +${currentChallenge.points} points`,
          });

          setTimeout(() => {
            setShowSuccessAnimation(false);
            if (currentLevel < CODE_CANVAS_CHALLENGES.length) {
              setCurrentLevel(prev => prev + 1);
            } else {
              toast({
                title: "🏆 All Levels Complete!",
                description: `Final Score: ${score + currentChallenge.points} points`,
              });
            }
          }, 2500);
        } else {
          toast({
            title: `${Math.round(matchPercentage)}% Match`,
            description: matchPercentage > 70 ? "Almost there! Keep trying." : "Not quite right. Check the pattern.",
            variant: matchPercentage > 70 ? "default" : "destructive"
          });
        }
      } else {
        // Show detailed error message - ensure we always have something to display
        const errorMsg = result.error || "Compilation failed. Check the console for detailed error information.";

        console.error('=== EXECUTION FAILED ===');
        console.error('Result success:', result.success);
        console.error('Result error:', result.error);
        console.error('Error type:', typeof result.error);
        console.error('Error is undefined:', result.error === undefined);
        console.error('Error is null:', result.error === null);
        console.error('Error is empty string:', result.error === '');
        console.error('Full result object:', result);
        console.error('=======================');

        toast({
          title: "❌ Execution Error",
          description: errorMsg,
          variant: "destructive",
          duration: 5000 // Show error longer
        });
      }

      setIsExecuting(false);
    } catch (err: any) {
      console.error('Unexpected error in handleRunCode:', err);
      toast({
        title: "❌ Unexpected Error",
        description: err?.message || "An unexpected error occurred",
        variant: "destructive"
      });
      setIsExecuting(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      toast({ title: "Please enter an answer", variant: "default" });
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) {
      toast({ title: "No question available", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const teamId = team?.team_id || team?.id;
      const questionId = currentQuestion.question_id;

      if (!teamId || !questionId) {
        throw new Error("Missing team ID or question ID");
      }

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: room?.code,
          teamId: String(teamId),
          questionId: questionId, // Use questionId (camelCase) as server expects
          answer: answer.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const result = await res.json();

      if (result.correct) {
        setScore(prev => prev + 10);
        toast({
          title: "✅ Correct!",
          description: "Bonus points earned! +10 points",
          className: "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800"
        });

        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setAnswer("");
        } else {
          toast({
            title: "🎊 All Bonus Questions Complete!",
            description: "Great job!"
          });
        }
      } else {
        toast({
          title: "❌ Incorrect",
          description: result.message || "Try again!",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      const errorMessage = error instanceof Error ? error.message : "Network error";
      toast({
        title: "Failed to submit answer",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipLevel = () => {
    if (currentLevel < CODE_CANVAS_CHALLENGES.length) {
      setCurrentLevel(prev => prev + 1);
      toast({ title: "Level skipped", description: "Moving to next challenge" });
    }
  };

  const renderGrid = () => {
    const targetSet = new Set(currentChallenge?.targetPattern.map(([x, y]) => `${x},${y}`) || []);

    return (
      <div className="relative p-8 rounded-2xl bg-[#0f172a] shadow-2xl border border-slate-800">
        {/* Neon Glow Background */}
        <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full pointer-events-none"></div>

        {showSuccessAnimation && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-2xl animate-in fade-in duration-300">
            <div className="flex flex-col items-center animate-bounce duration-1000">
              <div className="text-8xl drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">🎉</div>
              <div className="text-white font-bold text-2xl mt-4 drop-shadow-md">Level Complete!</div>
            </div>
          </div>
        )}

        <div className="relative">
          {/* X Axis Labels */}
          <div className="flex justify-between px-1 mb-2 text-xs font-mono font-bold text-slate-400">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="w-[8%] text-center">{i}</div>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Y Axis Labels */}
            <div className="flex flex-col justify-between py-1 text-xs font-mono font-bold text-slate-400">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="h-full flex items-center justify-center">{i}</div>
              ))}
            </div>

            {/* The Grid */}
            <div className="grid grid-cols-[repeat(10,1fr)] gap-2 w-full bg-slate-900/50 p-3 rounded-xl border border-slate-800 shadow-inner">
              {Array.from({ length: 10 }, (_, row) =>
                Array.from({ length: 10 }, (_, col) => {
                  const key = `${col},${row}`;
                  const isUser = userGrid.has(key);
                  const isTarget = targetSet.has(key);
                  const isCorrect = isUser && isTarget;
                  const isWrong = isUser && !isTarget;

                  return (
                    <div
                      key={key}
                      className={`
                        aspect-square rounded-md transition-all duration-300 transform 
                        flex items-center justify-center relative group
                        ${isCorrect
                          ? 'bg-gradient-to-br from-green-400 to-emerald-600 shadow-[0_0_15px_rgba(74,222,128,0.6)] scale-110 z-10'
                          : isWrong
                            ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.6)] scale-110 z-10'
                            : isTarget
                              ? 'bg-slate-800 border-2 border-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                              : 'bg-slate-800/40 border border-slate-800 hover:bg-slate-700/60'
                        }
                      `}
                      title={`(${col}, ${row})`}
                    >
                      {/* Inner dot for target pattern hints */}
                      {isTarget && !isUser && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50 animate-pulse"></div>
                      )}

                      {/* Tooltip on hover */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 font-mono">
                        {col}, {row}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!currentChallenge) {
    return <div>Loading...</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-purple-950 dark:to-pink-950 overflow-hidden flex flex-col">
      <GameHeader
        gameTitle="Code Canvas"
        gameIcon="🎨"
        team={team}
        room={room}
        showAchievements={false}
        showLeaderboard={true}
        extraInfo={
          <div className="flex items-center gap-3 mr-4">
            <div className="flex flex-col items-center px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
              <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">Level</span>
              <span className="text-sm font-bold text-purple-700 dark:text-purple-300 leading-none">{currentLevel}/{CODE_CANVAS_CHALLENGES.length}</span>
            </div>
            <div className="flex flex-col items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">Score</span>
              <span className="text-sm font-bold text-green-700 dark:text-green-300 leading-none">{score}</span>
            </div>
            <div className="hidden xl:flex flex-col items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Done</span>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300 leading-none">{completedLevels.length}</span>
            </div>
          </div>
        }
      />

      <div className="flex-1 container mx-auto px-4 py-4 max-w-[1600px] h-full overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr] gap-4 h-full">
          {/* Left: Challenge & Grid */}
          <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
            <Card className="p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-xl border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm shadow-lg">
                      🎯
                    </div>
                    <div>
                      <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent leading-tight">
                        {currentChallenge.title}
                      </h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 leading-snug">{currentChallenge.description}</p>
                  <div className="flex gap-2">
                    <Badge variant={currentChallenge.difficulty === 'easy' ? 'default' : currentChallenge.difficulty === 'medium' ? 'secondary' : 'destructive'} className="text-[10px] px-2 h-5">
                      {currentChallenge.difficulty.toUpperCase()}
                    </Badge>
                    <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow-sm text-[10px] px-2 h-5">
                      +{currentChallenge.points} pts
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5 mb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">💡</span>
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300">Hint:</span>
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{currentChallenge.hint}</div>
              </div>

              <div className="flex justify-center mb-3">
                {renderGrid()}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSkipLevel}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs border hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ⏭️ Skip
                </Button>
                <Button
                  onClick={() => setUserGrid(new Set())}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs border hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  🔄 Clear
                </Button>
              </div>
            </Card>

            {/* Bonus Question - Enhanced */}
            {currentQuestion && (
              <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-700 shadow-lg flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">⭐</span>
                    <h3 className="text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                      Bonus Question
                    </h3>
                  </div>
                  <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 shadow-sm text-[10px] h-5">
                    +10 pts
                  </Badge>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 mb-3 font-medium leading-snug">
                  {currentQuestion.question_text}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !submitting && handleSubmitAnswer()}
                    placeholder="Answer..."
                    disabled={submitting}
                    className="flex-1 h-9 text-sm dark:bg-slate-800 border focus:border-amber-400"
                  />
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={submitting || !answer.trim()}
                    size="sm"
                    className="h-9 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-md"
                  >
                    {submitting ? "..." : "✓"}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Right: Enhanced Code Editor */}
          <div className="h-full min-h-0">
            <Card className="p-0 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-2xl border-slate-200 dark:border-slate-700 h-full flex flex-col overflow-hidden">
              <div className="h-10 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1e1e1e] flex items-center justify-between px-4 flex-shrink-0">
                {/* Left: Language Selector */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span>Code Language:</span>
                    <div className="flex bg-slate-200 dark:bg-[#2d2d2d] rounded p-0.5">
                      <button
                        onClick={() => setLanguage('javascript')}
                        className={`px-3 py-1 rounded-[2px] text-xs transition-all ${language === 'javascript'
                          ? 'bg-white dark:bg-[#3e3e42] text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                      >
                        JavaScript
                      </button>
                      <button
                        onClick={() => setLanguage('c')}
                        className={`px-3 py-1 rounded-[2px] text-xs transition-all ${language === 'c'
                          ? 'bg-white dark:bg-[#3e3e42] text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                      >
                        C
                      </button>
                      <button
                        onClick={() => setLanguage('cpp')}
                        className={`px-3 py-1 rounded-[2px] text-xs transition-all ${language === 'cpp'
                          ? 'bg-white dark:bg-[#3e3e42] text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                      >
                        C++
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Reset code to template?')) {
                        setCode(LANGUAGE_TEMPLATES[language]);
                      }
                    }}
                    className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <span className="mr-1.5">↺</span> Reset
                  </Button>

                  <Button
                    onClick={handleRunCode}
                    disabled={isExecuting}
                    className="h-7 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-[3px] shadow-sm transition-colors"
                  >
                    {isExecuting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2"></div>
                        Running...
                      </>
                    ) : (
                      <>
                        <span className="mr-1.5">▶</span> Run Code
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* C/C++ Warning Banner */}
              {(language === 'c' || language === 'cpp') && (
                <div className="flex-shrink-0 bg-[#2d2d2d] border-b border-[#1e1e1e] px-4 py-1.5 flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="text-amber-500">⚠</span>
                  <span>Note: C/C++ compilation runs on a remote server and may take a few seconds. JSON output format required.</span>
                </div>
              )}

              <div className="flex-1 min-h-0 flex flex-col relative group">
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;

                    // Define VS Code Dark theme (LeetCode style)
                    monaco.editor.defineTheme('leetcode-dark', {
                      base: 'vs-dark',
                      inherit: true,
                      rules: [],
                      colors: {
                        'editor.background': '#1e1e1e',
                      }
                    });

                    monaco.editor.setTheme('leetcode-dark');

                    // Add type definitions for JavaScript
                    if (language === 'javascript') {
                      monaco.languages.typescript.javascriptDefaults.addExtraLib(`
                        function generatePattern(): [number, number][];
                      `, 'ts:filename/game.d.ts');
                    }
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: language === 'javascript' ? 2 : 4,
                  }}
                />
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
