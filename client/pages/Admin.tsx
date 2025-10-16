import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  AdminAddQuestionRequest,
  AdminCreateRoomRequest,
  AdminStateResponse,
  Room,
} from "@shared/api";

export default function AdminPage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("DEMO");
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const isAdmin = localStorage.getItem("bingo.admin") === "true";
    if (!isAdmin) navigate("/");
  }, [navigate]);

  const load = async (code: string) => {
    const res = await fetch(
      `/api/admin/state?room=${encodeURIComponent(code)}`,
    );
    if (res.ok) {
      const data = (await res.json()) as AdminStateResponse;
      setState(data);
    } else {
      setState(null);
    }
  };

  useEffect(() => {
    load(roomCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, createRoom: true }));
    try {
      const body: AdminCreateRoomRequest = {
        code: roomCode.trim().toUpperCase(),
        title: `${roomCode.trim().toUpperCase()} Room`,
        durationMinutes: null,
      };
      await fetch("/api/admin/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load(body.code);
    } finally {
      setLoading(prev => ({ ...prev, createRoom: false }));
    }
  };

  const [showStartTimer, setShowStartTimer] = useState(false);
  const [showExtendTimer, setShowExtendTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState("");

  const startTimer = async () => {
    const minutes = Number(timerMinutes);
    if (!minutes || minutes <= 0) return;
    setLoading(prev => ({ ...prev, startTimer: true }));
    try {
      await fetch("/api/admin/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      setShowStartTimer(false);
      setTimerMinutes("");
      await load(roomCode);
    } finally {
      setLoading(prev => ({ ...prev, startTimer: false }));
    }
  };

  const extendTimer = async () => {
    const minutes = Number(timerMinutes);
    if (!minutes || minutes <= 0) return;
    setLoading(prev => ({ ...prev, extendTimer: true }));
    try {
      await fetch("/api/admin/extend-timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      setShowExtendTimer(false);
      setTimerMinutes("");
      await load(roomCode);
    } finally {
      setLoading(prev => ({ ...prev, extendTimer: false }));
    }
  };

  const forceEnd = async () => {
    setLoading(prev => ({ ...prev, forceEnd: true }));
    try {
      await fetch("/api/admin/force-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await load(roomCode);
    } finally {
      setLoading(prev => ({ ...prev, forceEnd: false }));
    }
  };
  const seedDemo = async () => {
    setLoading(prev => ({ ...prev, seedDemo: true }));
    try {
      await fetch("/api/admin/seed-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomCode.toUpperCase() }),
      });
      await load(roomCode);
    } finally {
      setLoading(prev => ({ ...prev, seedDemo: false }));
    }
  };

  const addQuestion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, addQuestion: true }));
    try {
      const fd = new FormData(e.currentTarget);
      const question_text = String(fd.get("qt") || "");
      const correct_answer = String(fd.get("ans") || "");
      const is_real = Boolean(fd.get("is_real"));
      const body: AdminAddQuestionRequest = {
        room: roomCode.toUpperCase(),
        question_text,
        correct_answer,
        is_real,
      };
      await fetch("/api/admin/add-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      (e.target as HTMLFormElement).reset();
      await load(roomCode);
    } finally {
      setLoading(prev => ({ ...prev, addQuestion: false }));
    }
  };

  const deleteQuestion = async (id: number) => {
    setLoading(prev => ({ ...prev, [`deleteQuestion_${id}`]: true }));
    try {
      await fetch("/api/admin/delete-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomCode.toUpperCase(), question_id: id }),
      });
      await load(roomCode);
    } finally {
      setLoading(prev => ({ ...prev, [`deleteQuestion_${id}`]: false }));
    }
  };

  const room = state?.room as Room | undefined;
  const realCount = state?.questions.filter((q) => q.is_real).length || 0;
  const fakeCount = state ? state.questions.length - realCount : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <header className="sticky top-0 bg-white/80 backdrop-blur border-b">
        <div className="container py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">
              Manage rooms, questions, and timer
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/leaderboard?room=${encodeURIComponent(roomCode.toUpperCase())}`}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              Live Leaderboard
            </a>
            <a
              href="/leaderboard-all"
              className="px-3 py-1.5 rounded-lg border font-medium hover:bg-blue-50"
            >
              All Rooms
            </a>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <form
            onSubmit={createRoom}
            className="flex flex-col sm:flex-row gap-3 items-start sm:items-end"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Room Code
              </label>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="rounded-lg border px-3 py-2"
                placeholder="DEMO"
              />
            </div>
            <button
              disabled={loading.createRoom}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2"
            >
              {loading.createRoom && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              Create/Load Room
            </button>
            <button
              type="button"
              onClick={seedDemo}
              disabled={loading.seedDemo}
              className="px-4 py-2 rounded-lg border font-semibold hover:bg-blue-50 disabled:opacity-60 flex items-center gap-2"
            >
              {loading.seedDemo && (
                <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
              )}
              Seed Demo Questions
            </button>
            <button
              type="button"
              onClick={() => setShowStartTimer(true)}
              className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
            >
              Start Timer
            </button>
            <button
              type="button"
              onClick={() => setShowExtendTimer(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              Extend
            </button>
            <button
              type="button"
              onClick={forceEnd}
              disabled={loading.forceEnd}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
            >
              {loading.forceEnd && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              Force End
            </button>
          </form>
          {room && (
            <div className="mt-3 text-sm text-slate-600">
              Room: <span className="font-semibold">{room.code}</span> · Title:{" "}
              {room.title} · Ends:{" "}
              {room.roundEndAt
                ? new Date(room.roundEndAt).toLocaleTimeString()
                : "Not started"}
            </div>
          )}
        </section>

        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-3">Add Question</h2>
          <form
            onSubmit={addQuestion}
            className="grid grid-cols-1 md:grid-cols-6 gap-3"
          >
            <textarea
              name="qt"
              required
              placeholder="Paste full C code here (question)."
              rows={8}
              className="md:col-span-4 rounded-lg border px-3 py-2 font-mono whitespace-pre-wrap"
            />
            <input
              name="ans"
              required
              placeholder="Correct output"
              className="md:col-span-1 rounded-lg border px-3 py-2"
            />
            <label className="flex items-center gap-2 md:col-span-1 text-sm">
              <input
                type="checkbox"
                name="is_real"
                defaultChecked
                className="accent-blue-600"
              />{" "}
              Real
            </label>
            <div className="md:col-span-6">
              <button
                disabled={loading.addQuestion}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2"
              >
                {loading.addQuestion && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                Add
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">
              Questions ({state?.questions.length || 0})
            </h2>
            <span className="text-sm text-slate-600">
              Real: {realCount} · Fake: {fakeCount}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {state?.questions.map((q) => (
              <div key={q.question_id} className="border rounded-lg p-3">
                <pre className="text-sm text-slate-800 font-mono whitespace-pre-wrap">
                  {q.question_text}
                </pre>
                <div className="mt-1 text-xs text-slate-500">
                  Answer: {q.correct_answer} ·{" "}
                  {q.is_real ? (
                    <span className="text-green-700">Real</span>
                  ) : (
                    <span className="text-amber-700">Fake</span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => deleteQuestion(q.question_id)}
                    disabled={loading[`deleteQuestion_${q.question_id}`]}
                    className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm disabled:opacity-60 flex items-center gap-2"
                  >
                    {loading[`deleteQuestion_${q.question_id}`] && (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-3">Teams</h2>
          <div className="grid grid-cols-4 gap-0 border-b bg-blue-50 text-blue-900 font-semibold text-sm">
            <div className="px-4 py-2">Team</div>
            <div className="px-4 py-2">Lines</div>
            <div className="px-4 py-2">Started</div>
            <div className="px-4 py-2">Ended</div>
          </div>
          {state?.teams.map((t) => (
            <div
              key={t.team_id}
              className="grid grid-cols-4 gap-0 border-b last:border-b-0"
            >
              <div className="px-4 py-2">{t.team_name}</div>
              <div className="px-4 py-2">{t.lines_completed}</div>
              <div className="px-4 py-2">
                {new Date(t.start_time).toLocaleTimeString()}
              </div>
              <div className="px-4 py-2">
                {t.end_time ? new Date(t.end_time).toLocaleTimeString() : "—"}
              </div>
            </div>
          ))}
        </section>
      </main>

      {showStartTimer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Start Timer for All Rooms</h3>
            <input
              type="number"
              value={timerMinutes}
              onChange={(e) => setTimerMinutes(e.target.value)}
              placeholder="Minutes"
              className="w-full rounded-lg border px-3 py-2 mb-4"
              min="1"
            />
            <div className="flex gap-2">
              <button
                onClick={startTimer}
                disabled={loading.startTimer}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading.startTimer && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                Start
              </button>
              <button
                onClick={() => {
                  setShowStartTimer(false);
                  setTimerMinutes("");
                }}
                className="flex-1 border py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showExtendTimer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Extend Timer for All Rooms</h3>
            <input
              type="number"
              value={timerMinutes}
              onChange={(e) => setTimerMinutes(e.target.value)}
              placeholder="Minutes"
              className="w-full rounded-lg border px-3 py-2 mb-4"
              min="1"
            />
            <div className="flex gap-2">
              <button
                onClick={extendTimer}
                disabled={loading.extendTimer}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading.extendTimer && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                Extend
              </button>
              <button
                onClick={() => {
                  setShowExtendTimer(false);
                  setTimerMinutes("");
                }}
                className="flex-1 border py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
