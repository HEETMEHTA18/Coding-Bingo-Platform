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
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
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
    if (
      (data.room as GameStateResponse["room"]).roundEndAt &&
      Date.now() > (data.room as GameStateResponse["room"]).roundEndAt!
    )
      setDisabled(true);
  };

  useEffect(() => {
    loadState();
    const id = setInterval(loadState, 5000);
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
    const q = (questions ?? []).find((x) => x.question_id === qid);
    if (q && !q.is_real)
      setStatus({ type: "warn", text: "Fake Question – No Bingo Point" });
    else setStatus(null);
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
    if (!team || !selectedQid) return;
    setStatus(null);

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
  };

  const timeLeft = useMemo(() => {
    if (!room?.roundEndAt) return null;
    const ms = Math.max(0, room.roundEndAt - now);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [room?.roundEndAt, now]);

  const isSolvedPos = (pos: string) => solved.includes(pos);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="container py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800">Game – Coding Bingo</h1>
            <p className="text-sm text-slate-500">
              Team: {team?.team_name} · Room: {room?.code}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {timeLeft && (
              <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                ⏱ {timeLeft}
              </span>
            )}
            <a
              href="/leaderboard"
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              Leaderboard
            </a>
          </div>
        </div>
      </header>

      <main className="container py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-3">Questions (35)</h2>
          <div className="hidden">
            {questions.map((q) => (
              <button
                key={q.question_id}
                onClick={() => onSelectQuestion(q.question_id)}
                className={`text-left rounded-lg border px-3 py-2 hover:bg-blue-50 ${
                  selectedQid === q.question_id ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="text-sm text-slate-800 line-clamp-2">
                  {q.question_text}
                </div>
                <div className="mt-1 text-xs">
                  {q.is_real ? (
                    <span className="text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">
                      Real
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      Fake
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {selectedQuestion && (
            <>
              <div className="mt-4">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Question{" "}
                  {Math.max(
                    0,
                    (questions ?? []).findIndex(
                      (q) => q.question_id === selectedQid,
                    ),
                  ) + 1}
                </div>
                <pre className="whitespace-pre-wrap font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-80 overflow-auto">
                  {selectedQuestion.question_text}
                </pre>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectByDelta(-1)}
                  className="px-3 py-2 rounded-lg border font-semibold hover:bg-blue-50 mr-auto"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => selectByDelta(1)}
                  className="px-3 py-2 rounded-lg border font-semibold hover:bg-blue-50"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => selectByDelta(1)}
                  className="px-3 py-2 rounded-lg border font-semibold hover:bg-blue-50 ml-auto"
                >
                  Next
                </button>
              </div>
              <form onSubmit={onSubmit} className="mt-3 flex gap-2">
                <input
                  disabled={disabled}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Enter output only"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  disabled={disabled}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60"
                >
                  Submit
                </button>
              </form>
            </>
          )}
          {status && (
            <div
              className={`mt-3 text-sm font-medium px-3 py-2 rounded-lg border ${
                status.type === "success"
                  ? "text-green-700 bg-green-50 border-green-200"
                  : status.type === "error"
                    ? "text-red-700 bg-red-50 border-red-200"
                    : status.type === "warn"
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-slate-700 bg-slate-50 border-slate-200"
              }`}
            >
              {status.text}
            </div>
          )}
        </section>

        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Bingo Grid (5×5)</h2>
            <span className="text-sm text-slate-600">Lines: {lines} / 5</span>
          </div>
          <BingoGrid solved={solved} />
          <p className="text-xs text-slate-500 mt-3">
            Fill any 5 lines (row/column/diagonal) to win.
          </p>
        </section>
      </main>
    </div>
  );
}

function BingoGrid({ solved }: { solved: string[] }) {
  const letters = ["A", "B", "C", "D", "E"];
  return (
    <div className="grid grid-cols-5 gap-2">
      {letters.map((L, r) =>
        Array.from({ length: 5 }).map((_, c) => {
          const pos = `${letters[r]}${c + 1}`;
          const isOn = solved.includes(pos);
          return (
            <div
              key={pos}
              className={`aspect-square rounded-lg border flex items-center justify-center text-sm font-semibold ${
                isOn
                  ? "bg-green-50 border-green-300 text-green-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
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
