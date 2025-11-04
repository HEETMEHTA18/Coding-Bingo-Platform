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

  useEffect(() => {
    const isAdmin = localStorage.getItem("bingo.admin") === "true";
    if (isAdmin) {
      navigate("/admin");
      return;
    }
    if (!team) navigate("/");
  }, [team, navigate]);

  const loadState = async () => {
    if (!team) return;
    const res = await fetch(
      `/api/game-state?teamId=${encodeURIComponent(team.team_id)}`,
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
    setQuestions(data.questions as GameStateResponse["questions"]);
    setSolved(data.solved_positions as string[]);
    // derive lines
    setLines(computeLines(data.solved_positions as string[]));
    // Dynamically enable/disable based on current timer status
    const currentRoom = data.room as GameStateResponse["room"];
    const isExpired = currentRoom.roundEndAt && Date.now() > new Date(currentRoom.roundEndAt).getTime();
    setDisabled(isExpired);
  };

  useEffect(() => {
    loadState();
    const id = setInterval(loadState, 5000); // Check for timer updates every 5 seconds
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      clearInterval(tick);
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

  return (
    <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-7xl">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          {/* Coding Challenge Section */}
          <div className="bg-gray-800 rounded-2xl p-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="bg-purple-600 p-3 rounded-lg">
                  {/* Placeholder for Laptop icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-laptop"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55A1 1 0 0 1 20.7 20H3.3a1 1 0 0 1-.58-1.45L4 16"/></svg>
                </div>
                <h2 className="font-bold text-2xl">Coding Challenge</h2>
              </div>
              <div className="text-sm bg-gray-700 px-3 py-1.5 rounded-full">
                {questions.length} questions available
              </div>
            </div>

            {/* Question Display */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Question {Math.max(0, (questions ?? []).findIndex((q) => q.question_id === selectedQid)) + 1}</span>
                <span className="text-xs bg-gray-700 px-2 py-1 rounded">main.c</span>
              </div>
              <div className="bg-black text-left p-4 rounded-md overflow-x-auto">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  <code>{selectedQuestion?.question_text}</code>
                </pre>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex justify-between items-center">
               <button type="button" onClick={() => selectByDelta(-1)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                Previous
              </button>
              <div className="flex items-center gap-2">
                {/* Dots for pagination, simplified */}
                <span className="w-2.5 h-2.5 bg-gray-600 rounded-full"></span>
                <span className="w-2.5 h-2.5 bg-purple-500 rounded-full"></span>
                <span className="w-2.5 h-2.5 bg-gray-600 rounded-full"></span>
                <span className="w-2.5 h-2.5 bg-gray-600 rounded-full"></span>
                <span className="w-2.5 h-2.5 bg-gray-600 rounded-full"></span>
              </div>
              <button type="button" onClick={() => selectByDelta(1)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                Browse
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
          </div>
          {/* Your Solution Section */}
          <div className="bg-gray-800 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-purple-600 p-3 rounded-lg">
                {/* Placeholder for Lightbulb icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lightbulb"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 9 5c0 1.3.5 2.6 1.5 3.5.7.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
              </div>
              <h2 className="font-bold text-2xl">Your Solution</h2>
            </div>
            <p className="text-sm text-gray-400">Enter your answer output</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <input
                disabled={disabled || submitting}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your solution here..."
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {status && (
                <div
                  className={`text-sm font-medium px-3 py-2 rounded-lg border ${
                    status.type === "success"
                      ? "text-green-400 bg-green-900/50 border-green-700"
                      : status.type === "error"
                        ? "text-red-400 bg-red-900/50 border-red-700"
                        : status.type === "warn"
                          ? "text-yellow-400 bg-yellow-900/50 border-yellow-700"
                          : "text-gray-400 bg-gray-700/50 border-gray-600"
                  }`}
                >
                  {status.text}
                </div>
              )}
               <button
                type="submit"
                disabled={disabled || submitting}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors duration-300"
              >
                {submitting && (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                Submit Answer
              </button>
            </form>
          </div>
        </div>

        {/* Right Column */}
        <div className="bg-gray-800 rounded-2xl p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-green-500 p-3 rounded-lg">
                {/* Placeholder for Dice icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dice-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/></svg>
              </div>
              <h2 className="font-bold text-2xl">Bingo Grid</h2>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">Lines: {lines} / 5</p>
              <p className="text-xs text-gray-400">{solved.length} / 25 cells filled</p>
            </div>
          </div>
          <BingoGrid solved={solved} />
           <p className="text-center text-sm text-gray-400">
            Fill any 5 lines (row/column/diagonal) to win the game! 🚀
          </p>
        </div>
      </div>
    </div>
  );
}

function BingoGrid({ solved }: { solved: string[] }) {
  const letters = ["B", "I", "N", "G", "O"];
  const rows = ["A", "B", "C", "D", "E"];
  return (
    <div className="grid grid-cols-5 gap-2">
      {/* BINGO headers */}
      {letters.map((letter) => (
        <div key={letter} className="text-center font-bold text-lg text-gray-400 pb-2">{letter}</div>
      ))}

      {/* Grid cells */}
      {rows.map((rowLetter) =>
        Array.from({ length: 5 }).map((_, colIndex) => {
          const pos = `${rowLetter}${colIndex + 1}`;
          const isOn = solved.includes(pos);
          return (
            <div
              key={pos}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                isOn
                  ? "bg-green-500 text-white shadow-lg scale-105"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              {pos}
            </div>
          );
        }),
      )}
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
