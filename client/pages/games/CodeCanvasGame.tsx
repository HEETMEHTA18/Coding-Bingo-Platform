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
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-6 rounded-xl shadow-2xl">
        {showSuccessAnimation && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-green-500/20 backdrop-blur-sm rounded-xl animate-pulse">
            <div className="text-6xl animate-bounce">🎉</div>
          </div>
        )}
        <div className="grid grid-cols-[repeat(10,1fr)] gap-1.5">
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
                  className={`aspect-square rounded-md transition-all duration-300 transform hover:scale-110 ${isCorrect
                      ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/50 animate-pulse'
                      : isWrong
                        ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/50'
                        : isTarget
                          ? 'bg-slate-600/40 border-2 border-dashed border-slate-500'
                          : 'bg-slate-700/50 hover:bg-slate-600/50'
                    }`}
                  title={`(${col}, ${row})`}
                />
              );
            })
          )}
        </div>
        {/* Coordinate labels */}
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>X: 0</span>
          <span>X: 9</span>
        </div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-6 text-xs text-slate-400 writing-mode-vertical">
          <span>Y: 0 - 9</span>
        </div>
      </div>
    );
  };

  if (!currentChallenge) {
    return <div>Loading...</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-purple-950 dark:to-pink-950">
      <GameHeader
        gameTitle="Code Canvas"
        gameIcon="🎨"
        team={team}
        room={room}
        showAchievements={false}
        showLeaderboard={true}
      />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Enhanced Stats with animations */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">Level</div>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {currentLevel}/{CODE_CANVAS_CHALLENGES.length}
            </div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <div className="text-sm font-semibold text-green-700 dark:text-green-300">Score</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{score}</div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">Completed</div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{completedLevels.length}</div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">Language</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {language === 'javascript' ? 'JS' : language.toUpperCase()}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Challenge & Grid */}
          <div className="space-y-4">
            <Card className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-2xl border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl shadow-lg">
                      🎯
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                        {currentChallenge.title}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Challenge #{currentLevel}</p>
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">{currentChallenge.description}</p>
                  <div className="flex gap-2">
                    <Badge variant={currentChallenge.difficulty === 'easy' ? 'default' : currentChallenge.difficulty === 'medium' ? 'secondary' : 'destructive'} className="text-sm">
                      {currentChallenge.difficulty.toUpperCase()}
                    </Badge>
                    <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow-md">
                      +{currentChallenge.points} pts
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4 shadow-inner">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">💡</span>
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-300">Hint:</span>
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">{currentChallenge.hint}</div>
              </div>

              {renderGrid()}

              <div className="flex gap-3 mt-4">
                <Button
                  onClick={handleSkipLevel}
                  variant="outline"
                  className="flex-1 border-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all transform hover:scale-105"
                >
                  ⏭️ Skip Level
                </Button>
                <Button
                  onClick={() => setUserGrid(new Set())}
                  variant="outline"
                  className="flex-1 border-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all transform hover:scale-105"
                >
                  🔄 Clear Grid
                </Button>
              </div>
            </Card>

            {/* Bonus Question - Enhanced */}
            {currentQuestion && (
              <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">⭐</span>
                    <h3 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                      Bonus Question
                    </h3>
                  </div>
                  <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 shadow-lg">
                    +10 pts
                  </Badge>
                </div>
                <p className="text-slate-800 dark:text-slate-200 mb-4 font-medium leading-relaxed">
                  {currentQuestion.question_text}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !submitting && handleSubmitAnswer()}
                    placeholder="Type your answer..."
                    disabled={submitting}
                    className="flex-1 dark:bg-slate-800 border-2 focus:border-amber-400 transition-all"
                  />
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={submitting || !answer.trim()}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                  >
                    {submitting ? "⏳" : "✓"} {submitting ? "Checking..." : "Submit"}
                  </Button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </Card>
            )}
          </div>

          {/* Right: Enhanced Code Editor */}
          <div>
            <Card className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-2xl border-slate-200 dark:border-slate-700 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-xl shadow-lg">
                    💻
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                    Code Editor
                  </h3>
                </div>

                {/* Language Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Language:</span>
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      onClick={() => setLanguage('javascript')}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${language === 'javascript'
                          ? 'bg-yellow-400 text-slate-900 shadow-md'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      JavaScript
                    </button>
                    <button
                      onClick={() => setLanguage('c')}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${language === 'c'
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      C
                    </button>
                    <button
                      onClick={() => setLanguage('cpp')}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${language === 'cpp'
                          ? 'bg-purple-500 text-white shadow-md'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      C++
                    </button>
                  </div>
                </div>
              </div>

              {/* C/C++ Warning Banner */}
              {(language === 'c' || language === 'cpp') && (
                <div className="animate-in fade-in-50 duration-300">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-3 flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                        ⚠️ Syntax Practice Only
                      </h4>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        <span className="font-medium">{language === 'c' ? 'C' : 'C++'}</span> code editor is for learning and syntax practice.
                        <span className="font-semibold"> Switch to JavaScript</span> to execute code and solve challenges.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0">
                <div className="border-2 border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-inner" style={{ height: '550px' }}>
                  <Editor
                    height="100%"
                    language={language}
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    onMount={(editor) => {
                      editorRef.current = editor;
                    }}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: true },
                      fontSize: 14,
                      fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                      fontLigatures: true,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: language === 'javascript' ? 2 : 4,
                      wordWrap: 'on',
                      formatOnPaste: true,
                      formatOnType: true,
                      suggestOnTriggerCharacters: true,
                      quickSuggestions: true,
                      folding: true,
                      renderWhitespace: 'selection',
                      bracketPairColorization: { enabled: true },
                    }}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Button
                  onClick={handleRunCode}
                  disabled={isExecuting}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg py-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Executing Code...
                    </>
                  ) : (
                    <>
                      <span className="text-2xl mr-2">▶️</span>
                      Run Code
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-4 p-4 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-slate-300 dark:border-slate-700">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  Requirements:
                </div>
                <ul className="list-none space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {language === 'javascript' ? (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        Define a function named <code className="bg-slate-300 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">generatePattern()</code>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        Return an array of [x, y] coordinates
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        Coordinates must be integers between 0-9
                      </li>
                    </>
                  ) : language === 'c' ? (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">✓</span>
                        Define function <code className="bg-slate-300 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">int generatePattern(int coordinates[][2])</code>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">✓</span>
                        Fill coordinates array with [x, y] pairs
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">✓</span>
                        Return count of coordinates added
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">✓</span>
                        Define function <code className="bg-slate-300 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">vector&lt;pair&lt;int,int&gt;&gt; generatePattern()</code>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">✓</span>
                        Return vector of coordinate pairs
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500">✓</span>
                        Use <code className="bg-slate-300 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">result.push_back({'{'}x, y{'}'})</code>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
