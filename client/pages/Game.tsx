import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AchievementManager } from "../achievements";
import { WinCelebration } from "../components/WinCelebration";
import { BingoWinnerModal } from "../components/BingoWinnerModal";
import type {
  GameStateResponse,
  SubmissionResult,
  Team,
  Room,
} from "@shared/api";

function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    if (raw === "undefined" || raw === "null") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
function useTeam(): Team | null {
  return safeParse<Team>(localStorage.getItem("bingo.team"));
}
function useRoom(): Room | null {
  return safeParse<Room>(localStorage.getItem("bingo.room"));
}

export default function GamePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = useTeam();
  const [room, setRoom] = useState<Room | null>(useRoom());
  const [questions, setQuestions] = useState<GameStateResponse["questions"]>(
    [] as GameStateResponse["questions"],
  );
  const [solved, setSolved] = useState<string[]>([]);
  const [selectedQid, setSelectedQid] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error" | "warn" | "info";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<number>(0);
  const [prevLines, setPrevLines] = useState<number>(0);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());
  const [recentSubs, setRecentSubs] = useState<
    { 
      teamId: string; 
      questionId: number; 
      submittedAnswer?: string;
      isCorrect?: boolean;
      solvedAt: string | Date; 
      position: string | null;
    }[]
  >([]);
  const achievementManager = useMemo(() => AchievementManager.getInstance(), []);

  // For UI highlights when a new line is completed
  const [highlightedPositions, setHighlightedPositions] = useState<string[]>([]);
  const highlightedTimerRef = useRef<number | null>(null);

  // Celebration and winner modal
  const [showCelebration, setShowCelebration] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  useEffect(() => {
    if (!team) navigate("/");
  }, [team, navigate]);

  const loadState = async () => {
    if (!team) return;
    const roomToUse = room || useRoom();
    if (!roomToUse) return;
    
    const res = await fetch(
      `/api/game?room=${encodeURIComponent(roomToUse.code)}&team=${encodeURIComponent(team.team_id)}`,
    );
    if (!res.ok) {
      // If team not found, clear stale localStorage and send back to login
      try {
        const err = (await res.json()) as { error?: string };
        if (res.status === 404 || err?.error === "Team not found") {
          localStorage.removeItem("bingo.team");
          localStorage.removeItem("bingo.room");
          navigate("/");
        }
      } catch {}
      return; // keep previous state
    }
    const data = (await res.json()) as Partial<GameStateResponse> &
      Record<string, unknown>;
    if (
      !data ||
      !Array.isArray(data.questions) ||
      !data.room ||
      !Array.isArray(data.solved_positions)
    )
      return;
    setRoom(data.room as GameStateResponse["room"]);
    localStorage.setItem("bingo.room", JSON.stringify(data.room));
    
    // // Debug logging
    // console.log("📊 Total questions received:", data.questions?.length);
    // console.log("📊 Questions with grid_position:", (data.questions as GameStateResponse["questions"]).filter(q => q.grid_position).length);
    
    // Show ALL questions, not just mapped ones
    // Users can browse all questions, but only mapped ones contribute to bingo
    const allQuestions = data.questions as GameStateResponse["questions"];
    
    // console.log("📊 All questions to display:", allQuestions.length);
    setQuestions(allQuestions);
    
    setSolved(data.solved_positions as string[]);
    // derive lines
    setLines(computeLines(data.solved_positions as string[]));
    // Dynamically enable/disable based on current timer status
    const currentRoom = data.room as GameStateResponse["room"];
    const isExpired = currentRoom.roundEndAt && Date.now() > new Date(currentRoom.roundEndAt).getTime();
    setDisabled(isExpired);
    // fetch recent submissions for this room (best-effort)
    try {
      if ((data.room as GameStateResponse['room'])?.code) {
        const rs = await fetch(`/api/recent-submissions?room=${encodeURIComponent((data.room as GameStateResponse['room']).code)}`);
        if (rs.ok) {
          const j = await rs.json();
          if (Array.isArray(j.rows)) {
            setRecentSubs(j.rows.map((r: any) => ({
              teamId: r.teamId,
              questionId: r.questionId,
              submittedAnswer: r.submittedAnswer,
              isCorrect: r.isCorrect,
              solvedAt: r.solvedAt,
              position: r.position || null,
            })));
          }
        }
      }
    } catch (e) {
      // ignore fetch errors for recent submissions
    }
  };

  useEffect(() => {
    // Notify achievement manager that a new game started
    achievementManager.onGameStart();

    loadState();
    const id = setInterval(loadState, 5000); // Check for timer updates every 5 seconds
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const subs = setInterval(() => {
      // refresh recent submissions every 5s after room is loaded
      if (room?.code) {
        fetch(`/api/recent-submissions?room=${encodeURIComponent(room.code)}`)
          .then((r) => r.ok ? r.json() : null)
          .then((j) => {
            if (j && Array.isArray(j.rows)) {
              setRecentSubs(j.rows.map((r: any) => ({
                teamId: r.teamId,
                questionId: r.questionId,
                submittedAnswer: r.submittedAnswer,
                isCorrect: r.isCorrect,
                solvedAt: r.solvedAt,
                position: r.position || null,
              })));
            }
          })
          .catch(() => {});
      }
    }, 5000);
    return () => {
      clearInterval(id);
      clearInterval(tick);
      clearInterval(subs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When lines change, detect newly completed lines and trigger achievements/celebration
  useEffect(() => {
    // call achievement manager on game win changes
    try {
      const newAchievements = achievementManager.onGameWin(lines);
      newAchievements.forEach((ach) => {
        toast({ title: `🏆 ${ach.title}`, description: ach.description });
      });

      // If we reached full bingo, also check flawless win
      if (lines >= 5) {
        const flawless = achievementManager.onFlawlessWin();
        flawless.forEach((ach) => toast({ title: `🏆 ${ach.title}`, description: ach.description }));
      }
    } catch (e) {
      // ignore
    }

    // If lines increased, highlight the newly completed lines briefly and show celebration
    if (lines > prevLines) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 4500);

      // compute newly completed lines positions
      const prevCompleted = computeCompletedLinesPositionsFromSolved(prevSolvedRef.current);
      const newCompleted = computeCompletedLinesPositionsFromSolved(solved);
      const prevIds = new Set(prevCompleted.map((l) => l.id));
      const newly = newCompleted.filter((l) => !prevIds.has(l.id));
      const positionsToHighlight = newly.flatMap((l) => l.positions);
      if (positionsToHighlight.length > 0) {
        setHighlightedPositions(positionsToHighlight);
        if (highlightedTimerRef.current) window.clearTimeout(highlightedTimerRef.current as any);
        highlightedTimerRef.current = window.setTimeout(() => setHighlightedPositions([]), 1800);
      }

      // Show winner modal when full bingo
      if (lines >= 5) setShowWinnerModal(true);
    }

    setPrevLines(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  // keep ref of previous solved for diffing
  const prevSolvedRef = useRef<string[]>([]);
  useEffect(() => {
    prevSolvedRef.current = solved;
  }, [solved]);

  useEffect(() => {
    if (!selectedQid && questions && questions.length > 0) {
      onSelectQuestion(questions[0].question_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const selectedQuestion = useMemo(
    () => (questions ?? []).find((q) => q.question_id === selectedQid) || null,
    [questions, selectedQid],
  );
  
  // Format code with proper indentation for C programs
  const formatCode = (code: string): string => {
    if (!code) return '';
    
    let formatted = code;
    
    // Step 1: Aggressively break everything onto separate lines
    formatted = formatted
      // Newline after preprocessor directives
      .replace(/(#include\s*<[^>]+>)/g, '$1\n')
      .replace(/(#include\s*"[^"]+")/g, '$1\n')
      .replace(/(#define\s+\w+[^\n]*)/g, '$1\n')
      
      // Break function declaration
      .replace(/\b(int|void|float|double|char|long|short|unsigned)\s+(main|[a-zA-Z_]\w*)\s*\(/g, '\n$1 $2(')
      
      // Newline after function opening brace
      .replace(/\)\s*\{/g, ') {\n')
      
      // Break variable declarations - newline after each semicolon
      .replace(/;\s*(?![\n})\s])/g, ';\n')
      
      // Break if statements - ensure condition and body on separate logical lines
      .replace(/\bif\s*\(/g, 'if (')
      .replace(/\)\s*(?=\w)/g, ')\n')
      
      // Break else if chains - CRITICAL for your case
      .replace(/;\s*}\s*else\s+if\s*\(/g, ';\n}\nelse if (')
      .replace(/\}\s*else\s+if\s*\(/g, '}\nelse if (')
      .replace(/;\s*else\s+if\s*\(/g, ';\n}\nelse if (')
      
      // Break else statements
      .replace(/;\s*}\s*else\s+(?!if)/g, ';\n}\nelse ')
      .replace(/\}\s*else\s+(?!if)/g, '}\nelse ')
      .replace(/;\s*else\s+(?!if)/g, ';\n}\nelse ')
      
      // Ensure opening braces start blocks properly
      .replace(/\{(?!\n)/g, '{\n')
      
      // Break switch/case statements
      .replace(/\bswitch\s*\(/g, 'switch (')
      .replace(/\bcase\s+/g, '\ncase ')
      .replace(/\bdefault\s*:/g, '\ndefault:')
      .replace(/break\s*;/g, 'break;\n')
      
      // Break while/for loops
      .replace(/\bwhile\s*\(/g, 'while (')
      .replace(/\bfor\s*\(/g, 'for (')
      
      // Keep for loop parts together but add spaces
      .replace(/;\s*(?=[^)]*\))/g, '; ')
      
      // Break do-while
      .replace(/\bdo\s*\{/g, 'do {\n')
      .replace(/\}\s*while/g, '}\nwhile')
      
      // Function calls - keep on one line but ensure newline after
      .replace(/(printf|scanf|fprintf|fscanf|sprintf|sscanf|puts|gets|getchar|putchar)\s*\([^)]*\)\s*;/g, '$&\n')
      
      // Return statements
      .replace(/\breturn\s+/g, 'return ')
      .replace(/return\s+([^;]+);/g, 'return $1;\n')
      
      // Closing braces
      .replace(/([^{\s])\s*\}/g, '$1\n}')
      .replace(/\}\s*(?!\n)/g, '}\n')
      
      // Clean up operators with proper spacing
      .replace(/\s*(==|!=|<=|>=|&&|\|\||>>|<<)\s*/g, ' $1 ')
      .replace(/\s*([+\-*/%])\s*/g, ' $1 ')
      .replace(/([^=!<>])\s*=\s*(?!=)/g, '$1 = ')
      
      // Space after commas
      .replace(/,(?!\s)/g, ', ')
      
      // Clean up multiple spaces
      .replace(/  +/g, ' ');
    
    // Step 2: Clean up excessive newlines
    formatted = formatted
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .replace(/\{\s*\n\s*\n/g, '{\n')
      .replace(/\n\s*\n\s*\}/g, '\n}')
      .replace(/^\s*\n/g, '');
    
    // Step 3: Apply consistent indentation
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const indentedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines but preserve structure
      if (!line) {
        if (indentedLines.length > 0 && indentedLines[indentedLines.length - 1] !== '') {
          indentedLines.push('');
        }
        continue;
      }
      
      // Decrease indent before closing braces, case/default labels, and else
      if (line.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      } else if (line.startsWith('case ') || line.startsWith('default:')) {
        indentLevel = Math.max(0, indentLevel - 1);
      } else if (line.startsWith('else')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      // Apply indentation
      const indent = '  '.repeat(indentLevel);
      indentedLines.push(indent + line);
      
      // Increase indent after opening braces
      if (line.endsWith('{')) {
        indentLevel++;
      } else if (line.startsWith('case ') || line.startsWith('default:')) {
        indentLevel++;
      }
      
      // Special handling: if else is followed by opening brace
      if (line.startsWith('else') && line.endsWith('{')) {
        // Indent already increased above
      }
      
      // Handle lines with both open and close braces
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      if (openBraces > 0 && closeBraces > 0) {
        indentLevel = Math.max(0, indentLevel + openBraces - closeBraces);
      }
    }
    
    return indentedLines.join('\n');
  };
  
  const formattedQuestionText = useMemo(() => {
    return selectedQuestion?.question_text ? formatCode(selectedQuestion.question_text) : '';
  }, [selectedQuestion]);

  const onSelectQuestion = (qid: number) => {
    setSelectedQid(qid);
    setAnswer("");
    setStatus(null);
  };

  const selectByDelta = (delta: number) => {
    if (!questions || questions.length === 0) return;
    const list = questions;
    const idx = selectedQid
      ? Math.max(
          0,
          list.findIndex((q) => q.question_id === selectedQid),
        )
      : 0;
    const nextIdx = (idx + delta + list.length) % list.length;
    onSelectQuestion(list[nextIdx].question_id);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !selectedQid || submitting || !room) return;
    setStatus(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: room.code,
          teamId: team.team_id,
          questionId: selectedQid,
          answer,
        }),
      });
      const data = (await res.json()) as SubmissionResult & { isFake?: boolean; assignedPosition?: string | null; message?: string };

      // Handle API response with correct boolean field
      if (!data.correct) {
        setStatus({ type: "error", text: "Incorrect! Try again" });
        toast({
          title: "❌ Incorrect Answer",
          description: `Your answer "${answer}" is wrong. Please try again!`,
          variant: "destructive",
        });
      } else if (data.assignedPosition === null && data.message === "You already solved this question!") {
        // Question already solved - don't assign new grid position
        setStatus({ type: "info", text: "Already solved this one!" });
        toast({
          title: "ℹ️ Already Solved",
          description: "You've already solved this question correctly!",
        });
        
        // Auto-advance to next question after 1 second
        setTimeout(() => {
          setAnswer("");
          selectByDelta(1);
        }, 1000);
      } else if (data.isFake) {
        // Fake question - correct but no bingo point
        setStatus({ type: "warn", text: "Correct! But this is a bonus question (no bingo point)" });
        toast({
          title: "✅ Correct!",
          description: "This was a bonus question - no grid position earned.",
        });
        await loadState();
        
        // Auto-advance to next question after 1.5 seconds
        setTimeout(() => {
          setAnswer("");
          selectByDelta(1);
        }, 1500);
      } else {
        // Correct answer on real question - reload game state to get updated positions
        await loadState();
        setStatus({ type: "success", text: "Correct Answer!" });
        toast({
          title: "✅ Correct!",
          description: data.assignedPosition 
            ? `Great job! Grid position ${data.assignedPosition} filled!` 
            : "Great job! Keep going!",
        });
        // Check for achievement
        if (data.achievement) {
          toast({
            title: `🏆 ${data.achievement.title}`,
            description: data.achievement.description,
          });
        }
        
        // Auto-advance to next question after 1.5 seconds
        setTimeout(() => {
          setAnswer("");
          selectByDelta(1);
        }, 1500);
      }
    } catch (error) {
      console.error("Submission error:", error);
      setStatus({ type: "error", text: "Failed to submit answer" });
      toast({
        title: "❌ Error",
        description: "Failed to submit your answer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const timeLeft = useMemo(() => {
    if (!room?.roundEndAt) return null;
    const ms = Math.max(0, new Date(room.roundEndAt).getTime() - now);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [room?.roundEndAt, now]);

  const isSolvedPos = (pos: string) => solved.includes(pos);

  const currentQuestionIndex = selectedQid 
    ? questions.findIndex(q => q.question_id === selectedQid) 
    : 0;
  const totalQuestions = questions.length;
  const solvedCount = solved.filter(pos => pos).length;

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#1e293b]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          {/* Left: Logo and Info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h1 className="font-bold text-xl text-white">Coding Bingo</h1>
              <p className="text-sm text-slate-400">
                <span className="text-green-400">●</span> Team: {team?.team_name} · Room: {room?.code}
              </p>
            </div>
          </div>

          {/* Right: Timer and Action Buttons */}
          <div className="flex items-center gap-3">
            {timeLeft && (
              <div className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white flex items-center gap-2">
                <span>⏱️</span>
                <span className="font-mono font-semibold">{timeLeft}</span>
              </div>
            )}
            <button
              onClick={() => navigate("/achievements")}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors flex items-center gap-2"
            >
              <span>🏆</span>
              <span>Achievements</span>
            </button>
            <button
              onClick={() => navigate("/leaderboard")}
              className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors flex items-center gap-2"
            >
              <span>�</span>
              <span>Leaderboard</span>
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("bingo.team");
                localStorage.removeItem("bingo.room");
                navigate("/");
              }}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center gap-2"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-6">
          {/* Left Column - Coding Challenge */}
          <div className="space-y-6">
            {/* Coding Challenge Card */}
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                    <span className="text-2xl">💻</span>
                  </div>
                  <h2 className="font-bold text-2xl text-white">Coding Challenge</h2>
                </div>
                <span className="px-4 py-2 rounded-full text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {questions.length} questions available
                </span>
              </div>

              {selectedQuestion ? (
                <div className="space-y-6">
                  {/* Unified Question & Solution Card */}
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                    {/* Question Header */}
                    <div className="px-5 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">💻</span>
                        <h3 className="text-lg font-bold text-white">
                          Question {currentQuestionIndex + 1}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-md bg-slate-700 text-xs font-mono font-semibold text-slate-300 border border-slate-600">
                          C
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-red-500"></span>
                          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                          <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Code Display */}
                    <div className="relative bg-[#0f1419]">
                      <pre className="p-6 text-sm leading-relaxed overflow-x-auto">
                        <code className="font-mono text-slate-100">{formattedQuestionText}</code>
                      </pre>
                    </div>

                    {/* Solution Input Section */}
                    <div className="bg-gradient-to-br from-slate-900/70 to-slate-800/50 border-t border-slate-700 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                          <span className="text-xl">💡</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Your Solution</h3>
                          <p className="text-sm text-slate-400">Enter the output of the C program</p>
                        </div>
                      </div>
                      
                      <form onSubmit={onSubmit} className="space-y-4">
                        <div className="relative">
                          <input
                            type="text"
                            disabled={disabled || submitting}
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Type your answer here..."
                            className="w-full px-4 py-3.5 rounded-lg bg-slate-900 border-2 border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono"
                            autoFocus
                          />
                          {answer && (
                            <button
                              type="button"
                              onClick={() => setAnswer("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setAnswer("");
                              selectByDelta(1);
                            }}
                            className="flex-1 px-4 py-3 rounded-lg bg-slate-800 border-2 border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600 transition-all font-semibold"
                          >
                            Skip Question
                          </button>
                          <button
                            type="submit"
                            disabled={disabled || submitting || !answer.trim()}
                            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                          >
                            {submitting && (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            )}
                            <span>Submit Answer</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                    <button
                      onClick={() => selectByDelta(-1)}
                      className="px-5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600 transition-all font-medium flex items-center gap-2"
                    >
                      <span>←</span>
                      <span>Previous</span>
                    </button>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-slate-300">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </span>
                      <div className="flex gap-1.5">
                        {[...Array(Math.min(7, questions.length))].map((_, i) => {
                          const isActive = i === Math.min(currentQuestionIndex, 6);
                          return (
                            <span
                              key={i}
                              className={`w-2 h-2 rounded-full transition-all ${
                                isActive
                                  ? "bg-blue-500 w-6"
                                  : "bg-slate-700"
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => selectByDelta(1)}
                      className="px-5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600 transition-all font-medium flex items-center gap-2"
                    >
                      <span>Next</span>
                      <span>→</span>
                    </button>
                  </div>

                  {status && (
                    <div
                      className={`px-5 py-4 rounded-xl border-2 font-semibold flex items-center gap-3 shadow-lg animate-in ${
                        status.type === "success"
                          ? "bg-green-900/40 border-green-500 text-green-200"
                          : status.type === "error"
                            ? "bg-red-900/40 border-red-500 text-red-200"
                            : status.type === "warn"
                              ? "bg-amber-900/40 border-amber-500 text-amber-200"
                              : "bg-blue-900/40 border-blue-500 text-blue-200"
                      }`}
                    >
                      <span className="text-xl">
                        {status.type === "success" ? "✓" : status.type === "error" ? "✗" : status.type === "warn" ? "⚠️" : "ℹ️"}
                      </span>
                      <span>{status.text}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 flex items-center justify-center mb-6 shadow-2xl">
                    <span className="text-6xl">🎯</span>
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-3">Ready to Code?</h3>
                  <p className="text-slate-400 mb-6 max-w-md text-lg">
                    Select a question from the bingo grid or use navigation to start solving challenges!
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (questions.length > 0) onSelectQuestion(questions[0].question_id);
                      }}
                      className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-lg"
                    >
                      Start First Question
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <span className="text-xl">⚡</span>
                </div>
                <h3 className="text-xl font-bold text-white">Recent Activity</h3>
                {recentSubs.length > 0 && (
                  <span className="ml-auto px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
                    {recentSubs.length} submissions
                  </span>
                )}
              </div>
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
                {recentSubs.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                      <span className="text-3xl opacity-50">⚡</span>
                    </div>
                    <p className="text-sm text-slate-400">No recent submissions yet</p>
                    <p className="text-xs text-slate-500 mt-1">Activity will appear here as teams solve questions</p>
                  </div>
                ) : (
                  <div className="max-h-[280px] overflow-y-auto p-4 space-y-2">
                    {recentSubs.slice(0, 10).map((sub, idx) => {
                      const timeAgo = sub.solvedAt 
                        ? Math.floor((Date.now() - new Date(sub.solvedAt).getTime()) / 1000)
                        : 0;
                      const timeStr = timeAgo < 60 
                        ? `${timeAgo}s ago`
                        : timeAgo < 3600
                          ? `${Math.floor(timeAgo / 60)}m ago`
                          : `${Math.floor(timeAgo / 3600)}h ago`;
                      
                      const isCorrect = sub.isCorrect !== false; // Default to true for backward compatibility
                      
                      return (
                        <div 
                          key={`${sub.teamId}-${sub.questionId}-${idx}`}
                          className={`px-4 py-3 rounded-lg border transition-colors ${
                            isCorrect 
                              ? 'bg-slate-800/70 border-slate-700 hover:bg-slate-800'
                              : 'bg-red-900/20 border-red-800/50 hover:bg-red-900/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isCorrect
                                  ? 'bg-green-500/20 border border-green-500/30'
                                  : 'bg-red-500/20 border border-red-500/30'
                              }`}>
                                <span className={`text-sm ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                  {isCorrect ? '✓' : '✗'}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-white truncate">
                                  {sub.teamId}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {isCorrect ? 'Solved' : 'Attempted'} Q#{sub.questionId}
                                  {!isCorrect && sub.submittedAnswer && (
                                    <span className="text-red-400 ml-1">
                                      (answered: {sub.submittedAnswer})
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {sub.position && (
                                <span className="px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30">
                                  {sub.position}
                                </span>
                              )}
                              <span className="text-xs text-slate-500 whitespace-nowrap">{timeStr}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Bingo Grid */}
          <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 xl:w-[520px] shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🎲</span>
                </div>
                <div>
                  <h2 className="font-bold text-2xl text-white">Bingo Grid</h2>
                  <p className="text-sm text-slate-400">Complete lines to win!</p>
                </div>
              </div>
              <div className="text-right">
                <div className="px-4 py-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                  <p className="text-xs text-emerald-300 font-semibold">Lines</p>
                  <p className="text-2xl font-bold text-white">{lines} / 5</p>
                </div>
              </div>
            </div>
            <div className="mb-5 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500"></div>
                <span className="text-xs text-slate-400">Solved: {solvedCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-slate-700"></div>
                <span className="text-xs text-slate-400">Remaining: {25 - solvedCount}</span>
              </div>
            </div>
            <BingoGrid
              solved={solved}
              onSelectQuestion={onSelectQuestion}
              questions={questions}
              highlightedPositions={highlightedPositions}
            />
            <WinCelebration show={showCelebration} linesCompleted={lines} onComplete={() => setShowCelebration(false)} />
            <BingoWinnerModal show={showWinnerModal} onContinue={() => { setShowWinnerModal(false); }} />
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl">
              <p className="text-center text-sm text-blue-200 font-medium">
                🎯 Complete any 5 lines (rows, columns, or diagonals) to win!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function BingoGrid({ solved, onSelectQuestion, questions, highlightedPositions }: { 
  solved: string[]; 
  onSelectQuestion: (qid: number) => void;
  questions: GameStateResponse["questions"];
  highlightedPositions?: string[];
}) {
  const bingoLetters = ["B", "I", "N", "G", "O"];
  const gridRows = ["A", "B", "C", "D", "E"];
  
  return (
    <div className="space-y-3">
      {/* B-I-N-G-O Letters */}
      <div className="grid grid-cols-5 gap-2.5">
        {bingoLetters.map((letter, idx) => {
          const colCompleted = isColumnCompleted(solved, idx + 1);
          return (
            <div
              key={letter}
              className={`aspect-square flex items-center justify-center text-3xl font-extrabold bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300 rounded-lg border border-slate-700 relative overflow-hidden ${colCompleted ? 'ring-4 ring-emerald-400/40 scale-105' : ''}`}
            >
              <div className={`transition-opacity duration-300 ${colCompleted ? 'opacity-50 line-through text-emerald-200' : ''}`}>{letter}</div>
              {colCompleted && (
                <div className="absolute inset-0 flex items-center justify-center text-3xl text-white animate-bounce pointer-events-none">✓</div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Grid Cells */}
      <div className="grid grid-cols-5 gap-2.5">
        {gridRows.map((row) =>
          Array.from({ length: 5 }).map((_, colIndex) => {
            const position = `${row}${colIndex + 1}`;
            const isSolved = solved.includes(position);
            const isHighlighted = highlightedPositions?.includes(position) ?? false;
            
            return (
              <button
                key={position}
                onClick={() => onSelectQuestion(getQuestionIdForPosition(questions, position))}
                className={`aspect-square rounded-xl flex items-center justify-center text-lg font-bold border-2 transition-all duration-200 ${
                  isSolved
                    ? `bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/30 ${isHighlighted ? 'animate-pulse scale-105' : ''}`
                    : "bg-slate-800/70 border-slate-600 text-slate-300 cursor-default"
                }`}
              >
                {isSolved ? (
                  <span className="text-2xl">✓</span>
                ) : (
                  <span className="font-mono">{position}</span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function computeLines(posList: string[]): number {
  const set = new Set(posList);
  const letters = ["A", "B", "C", "D", "E"];
  let lines = 0;
  for (const L of letters) {
    let ok = true;
    for (let c = 1; c <= 5; c++) if (!set.has(`${L}${c}`)) ok = false;
    if (ok) lines++;
  }
  for (let c = 1; c <= 5; c++) {
    let ok = true;
    for (let r = 0; r < 5; r++) if (!set.has(`${letters[r]}${c}`)) ok = false;
    if (ok) lines++;
  }
  const diag1 = ["A1", "B2", "C3", "D4", "E5"];
  const diag2 = ["A5", "B4", "C3", "D2", "E1"];
  if (diag1.every((p) => set.has(p))) lines++;
  if (diag2.every((p) => set.has(p))) lines++;
  return lines;
}

// Helpers to determine completed lines and positions
function computeCompletedLinesPositionsFromSolved(posList: string[]) {
  const set = new Set(posList);
  const letters = ["A", "B", "C", "D", "E"];
  const results: { id: string; type: string; positions: string[] }[] = [];

  // rows
  letters.forEach((r) => {
    const positions = Array.from({ length: 5 }).map((_, i) => `${r}${i + 1}`);
    if (positions.every((p) => set.has(p))) results.push({ id: `row_${r}`, type: 'row', positions });
  });

  // cols
  for (let c = 1; c <= 5; c++) {
    const positions = letters.map((r) => `${r}${c}`);
    if (positions.every((p) => set.has(p))) results.push({ id: `col_${c}`, type: 'col', positions });
  }

  // diags
  const diag1 = ["A1","B2","C3","D4","E5"];
  const diag2 = ["A5","B4","C3","D2","E1"];
  if (diag1.every((p) => set.has(p))) results.push({ id: 'diag_1', type: 'diag', positions: diag1 });
  if (diag2.every((p) => set.has(p))) results.push({ id: 'diag_2', type: 'diag', positions: diag2 });

  return results;
}

function isColumnCompleted(solved: string[], colIndex: number) {
  const rows = ["A","B","C","D","E"];
  return rows.every((r) => solved.includes(`${r}${colIndex}`));
}

function getQuestionIdForPosition(questions: any[], position: string) {
  const q = questions.find((q) => q.grid_position === position);
  return q ? q.question_id : questions[0]?.question_id ?? 0;
}
