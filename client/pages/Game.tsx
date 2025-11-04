import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [disabled, setDisabled] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());
  const [recentSubs, setRecentSubs] = useState<
    { teamId: string; questionId: number; solvedAt: string | Date; position: string | null }[]
  >([]);

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
    
    // FILTER: Only show questions that have a grid_position (mapped questions)
    const mappedQuestions = (data.questions as GameStateResponse["questions"]).filter(
      q => q.grid_position !== null && q.grid_position !== undefined
    );
    setQuestions(mappedQuestions);
    
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
            setRecentSubs(j.rows.map((r) => ({
              teamId: r.teamId,
              questionId: r.questionId,
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
              setRecentSubs(j.rows.map((r) => ({
                teamId: r.teamId,
                questionId: r.questionId,
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
    if (!team || !selectedQid || submitting) return;
    setStatus(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.team_id,
          questionId: selectedQid,
          answer,
        }),
      });
      const data = (await res.json()) as SubmissionResult;

      if (data.status === "disabled") {
        setDisabled(true);
        setStatus({ type: "error", text: "Time over – submissions disabled" });
        return;
      }
      if (data.status === "empty") {
        setStatus({ type: "error", text: "Answer cannot be empty" });
        return;
      }
      if (data.status === "already_solved") {
        setSolved(data.solved_positions);
        setLines(data.lines_completed);
        setStatus({ type: "info", text: "Already Completed" });
        return;
      }
      if (data.status === "fake") {
        setStatus({ type: "warn", text: "Fake Question – No Bingo Point" });
        return;
      }
      if (data.status === "incorrect") {
        setStatus({ type: "error", text: "Incorrect! Try again" });
        return;
      }
      if (data.status === "correct") {
        setSolved(data.solved_positions);
        setLines(data.lines_completed);
        setStatus({ type: "success", text: "Correct Answer!" });
        if (data.win) {
          navigate("/congratulations");
        }
      }
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
                  {/* Question Card */}
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white">
                        Question {currentQuestionIndex + 1}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute top-3 right-3 px-2 py-1 rounded bg-slate-700 text-xs font-mono text-slate-400 border border-slate-600">
                        C
                      </div>
                      <pre className="p-6 text-sm font-mono text-slate-100 leading-relaxed overflow-x-auto bg-slate-900/80 whitespace-pre">
                        <code>{selectedQuestion.question_text}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between bg-slate-900/30 border border-slate-800 rounded-xl p-4">
                    <button
                      onClick={() => selectByDelta(-1)}
                      className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors font-medium"
                    >
                      ← Previous
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-400">
                        {currentQuestionIndex + 1} of {questions.length}
                      </span>
                      <div className="flex gap-1.5">
                        {[...Array(Math.min(5, questions.length))].map((_, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i === Math.min(currentQuestionIndex, 4)
                                ? "bg-blue-500"
                                : "bg-slate-700"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => selectByDelta(1)}
                      className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors font-medium"
                    >
                      Next →
                    </button>
                  </div>

                  {/* Your Solution */}
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl">💡</span>
                      <h3 className="text-lg font-bold text-white">Your Solution</h3>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">Enter your answer output</p>
                    <form onSubmit={onSubmit} className="space-y-4">
                      <input
                        type="text"
                        disabled={disabled || submitting}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Type your solution here..."
                        className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      />
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAnswer("");
                            selectByDelta(1);
                          }}
                          className="flex-1 px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors font-medium"
                        >
                          Skip Question
                        </button>
                        <button
                          type="submit"
                          disabled={disabled || submitting || !answer.trim()}
                          className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {submitting && (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          )}
                          Submit Answer
                        </button>
                      </div>
                    </form>
                  </div>

                  {status && (
                    <div
                      className={`px-4 py-3 rounded-lg border ${
                        status.type === "success"
                          ? "bg-green-900/30 border-green-500 text-green-300"
                          : status.type === "error"
                            ? "bg-red-900/30 border-red-500 text-red-300"
                            : "bg-slate-800/50 border-slate-600 text-slate-300"
                      }`}
                    >
                      {status.text}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-6">
                    <span className="text-5xl">🎯</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Ready to Code?</h3>
                  <p className="text-slate-400 mb-4 max-w-md">
                    Click on a cell in the bingo grid to start solving challenges!
                  </p>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">⚡</span>
                <h3 className="text-lg font-bold text-white">Recent Activity</h3>
              </div>
              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 max-h-[200px] overflow-y-auto">
                {recentSubs.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-4">No recent submissions yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentSubs.map((sub, idx) => {
                      const timeAgo = sub.solvedAt 
                        ? Math.floor((Date.now() - new Date(sub.solvedAt).getTime()) / 1000)
                        : 0;
                      const timeStr = timeAgo < 60 
                        ? `${timeAgo}s ago`
                        : timeAgo < 3600
                          ? `${Math.floor(timeAgo / 60)}m ago`
                          : `${Math.floor(timeAgo / 3600)}h ago`;
                      
                      return (
                        <div 
                          key={`${sub.teamId}-${sub.questionId}-${idx}`}
                          className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span className="text-sm text-slate-300 font-medium">
                              {sub.teamId}
                            </span>
                            {sub.position && (
                              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-mono border border-blue-500/30">
                                {sub.position}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">{timeStr}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Bingo Grid */}
          <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 xl:w-[500px]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <span className="text-2xl">🎲</span>
                </div>
                <h2 className="font-bold text-2xl text-white">Bingo Grid</h2>
              </div>
              <span className="px-4 py-2 rounded-full text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700">
                Lines: {lines} / 5
              </span>
            </div>
            <div className="mb-4">
              <span className="text-sm text-slate-400">
                {solvedCount} / 25 cells filled
              </span>
            </div>
            <BingoGrid solved={solved} onSelectQuestion={onSelectQuestion} questions={questions} />
            <p className="text-center text-sm text-slate-400 mt-6">
              Fill any 5 lines (row/column/diagonal) to win the game! 🔥
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function BingoGrid({ solved, onSelectQuestion, questions }: { 
  solved: string[]; 
  onSelectQuestion: (qid: number) => void;
  questions: GameStateResponse["questions"];
}) {
  const bingoLetters = ["B", "I", "N", "G", "O"];
  const gridRows = ["A", "B", "C", "D", "E"];
  
  return (
    <div>
      {/* B-I-N-G-O Letters */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {bingoLetters.map((letter) => (
          <div
            key={letter}
            className="aspect-square flex items-center justify-center text-2xl font-bold text-slate-500"
          >
            {letter}
          </div>
        ))}
      </div>
      
      {/* Grid Cells */}
      <div className="grid grid-cols-5 gap-2">
        {gridRows.map((row) =>
          Array.from({ length: 5 }).map((_, colIndex) => {
            const position = `${row}${colIndex + 1}`;
            const isSolved = solved.includes(position);
            const question = questions.find(q => q.grid_position === position);
            
            return (
              <button
                key={position}
                onClick={() => question && onSelectQuestion(question.question_id)}
                disabled={!question}
                className={`aspect-square rounded-xl flex items-center justify-center text-base font-bold border-2 transition-all ${
                  isSolved
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                    : question
                      ? "bg-slate-800/50 border-blue-500 text-blue-300 hover:bg-slate-700/50 cursor-pointer hover:scale-105"
                      : "bg-slate-900/30 border-slate-800 text-slate-700 cursor-not-allowed opacity-50"
                }`}
              >
                {position}
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
