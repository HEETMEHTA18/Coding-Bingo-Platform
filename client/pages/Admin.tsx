import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  AdminAddQuestionRequest,
  AdminCreateRoomRequest,
  AdminStateResponse,
  Room,
} from "@shared/api";
import { apiFetch } from "../lib/api";

export default function AdminPage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [selectedGameType, setSelectedGameType] = useState<string>("bingo");
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const isAdmin = localStorage.getItem("bingo.admin") === "true";
    if (!isAdmin) navigate("/");
  }, [navigate]);

  const load = async (code: string) => {
    const res = await apiFetch(
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
    if (roomCode) {
      load(roomCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading((prev) => ({ ...prev, createRoom: true }));
    try {
      const body: AdminCreateRoomRequest = {
        code: roomCode.trim().toUpperCase(),
        title: `${roomCode.trim().toUpperCase()} Room`,
        gameType: selectedGameType as any,
        durationMinutes: null,
      };
      await apiFetch("/api/admin/create-room", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load(body.code);
    } finally {
      setLoading((prev) => ({ ...prev, createRoom: false }));
    }
  };

  const [showStartTimer, setShowStartTimer] = useState(false);
  const [showExtendTimer, setShowExtendTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState("");

  const startTimer = async () => {
    const minutes = Number(timerMinutes);
    if (!minutes || minutes <= 0) return;
    setLoading((prev) => ({ ...prev, startTimer: true }));
    try {
      await apiFetch("/api/admin/start", {
        method: "POST",
        body: JSON.stringify({ minutes, room: roomCode }),
      });
      setShowStartTimer(false);
      setTimerMinutes("");
      await load(roomCode);
    } finally {
      setLoading((prev) => ({ ...prev, startTimer: false }));
    }
  };

  const extendTimer = async () => {
    const minutes = Number(timerMinutes);
    if (!minutes || minutes <= 0) return;
    setLoading((prev) => ({ ...prev, extendTimer: true }));
    try {
      await apiFetch("/api/admin/extend-timer", {
        method: "POST",
        body: JSON.stringify({ minutes, room: roomCode }),
      });
      setShowExtendTimer(false);
      setTimerMinutes("");
      await load(roomCode);
    } finally {
      setLoading((prev) => ({ ...prev, extendTimer: false }));
    }
  };

  const forceEnd = async () => {
    setLoading((prev) => ({ ...prev, forceEnd: true }));
    try {
      await apiFetch("/api/admin/force-end", {
        method: "POST",
        body: JSON.stringify({ room: roomCode }),
      });
      await load(roomCode);
    } finally {
      setLoading((prev) => ({ ...prev, forceEnd: false }));
    }
  };

  const addQuestion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading((prev) => ({ ...prev, addQuestion: true }));
    try {
      const fd = new FormData(e.currentTarget);
      const question_text = String(fd.get("qt") || "");
      const correct_answer = String(fd.get("ans") || "");
      const is_real = Boolean(fd.get("is_real"));
      const body: AdminAddQuestionRequest = {
        room: roomCode.toUpperCase(),
        question: {
          text: question_text,
          options: [], // TODO: Add options support
          correctAnswer: parseInt(correct_answer),
          points: 1, // TODO: Add points support
          isReal: is_real,
        },
      };
      await apiFetch("/api/admin/add-question", {
        method: "POST",
        body: JSON.stringify(body),
      });
      (e.target as HTMLFormElement).reset();
      await load(roomCode);
    } finally {
      setLoading((prev) => ({ ...prev, addQuestion: false }));
    }
  };

  const deleteQuestion = async (id: number) => {
    setLoading((prev) => ({ ...prev, [`deleteQuestion_${id}`]: true }));
    try {
      await apiFetch("/api/admin/delete-question", {
        method: "POST",
        // server accepts questionId (camelCase); send that to avoid 400s
        body: JSON.stringify({ room: roomCode.toUpperCase(), questionId: id }),
      });
      await load(roomCode);
    } finally {
      setLoading((prev) => ({ ...prev, [`deleteQuestion_${id}`]: false }));
    }
  };

  const uploadQuestions = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading((prev) => ({ ...prev, uploadQuestions: true }));
    try {
      const fd = new FormData(e.currentTarget);
      const file = fd.get("file") as File;
      if (!file) {
        alert("Please select a file to upload");
        return;
      }

      const fileData = new FormData();
      fileData.append("file", file);
      fileData.append("room", roomCode.toUpperCase());

      const response = await apiFetch("/api/admin/upload-questions", {
        method: "POST",
        body: fileData,
      });
      const result = await response.json();
      if (result.success) {
        alert(`Successfully uploaded ${result.importedCount} questions!`);
        (e.target as HTMLFormElement).reset();
        await load(roomCode);
      } else {
        alert(`Error: ${result.error}`);
      }
    } finally {
      setLoading((prev) => ({ ...prev, uploadQuestions: false }));
    }
  };

  // Wipe user data
  const [wipeOptions, setWipeOptions] = useState({
    softDelete: false,
    purgeQuestions: false,
    purgeRooms: false,
  });
  const [preserveRoomsText, setPreserveRoomsText] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [initiatedBy, setInitiatedBy] = useState("");

  const doWipe = async () => {
    if (!confirm("This is destructive. Type OK to proceed.")) return;
    setLoading((prev) => ({ ...prev, wipe: true }));
    try {
      const preserveRooms = preserveRoomsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        confirm: "WIPE",
        preserveRooms,
        purgeQuestions: wipeOptions.purgeQuestions,
        purgeRooms: wipeOptions.purgeRooms,
        softDelete: wipeOptions.softDelete,
        initiatedBy: initiatedBy || "admin-ui",
      } as any;

      const headers: any = { "Content-Type": "application/json" };
      if (adminSecret) headers["x-admin-secret"] = adminSecret;

      const res = await apiFetch("/api/admin/wipe", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        alert(
          `Wipe completed. Deleted counts: ${JSON.stringify(data.deleted)}`,
        );
        await load(roomCode);
      } else {
        alert(`Wipe failed: ${data.error || JSON.stringify(data)}`);
      }
    } finally {
      setLoading((prev) => ({ ...prev, wipe: false }));
    }
  };

  const room = state?.room as Room | undefined;
  const realCount = state?.questions.filter((q) => q.is_real).length || 0;
  const fakeCount = state ? state.questions.length - realCount : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-white/30 dark:border-slate-700/50 shadow-xl">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl">
              <span className="text-white font-bold text-xl">⚙️</span>
            </div>
            <div>
              <h1 className="font-bold text-2xl text-slate-800 dark:text-slate-200 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Manage rooms, questions, and game settings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-2 border border-white/30 dark:border-slate-600/50 shadow-lg">
              <a
                href={`/leaderboard?room=${encodeURIComponent(roomCode.toUpperCase())}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-2 border-blue-300/50"
                title="View Room Leaderboard"
              >
                <span className="text-lg">🏅</span>
                <span className="hidden sm:inline">Room Leaderboard</span>
              </a>

              <a
                href="/leaderboard-all"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-2 border-emerald-300/50"
                title="View All Rooms"
              >
                <span className="text-lg">🌍</span>
                <span className="hidden sm:inline">All Rooms</span>
              </a>

              <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

              <button
                onClick={() => {
                  localStorage.removeItem("bingo.admin");
                  navigate("/");
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white font-semibold hover:from-red-600 hover:via-rose-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-2 border-red-300/50"
                title="Logout"
              >
                <span className="text-lg">🚪</span>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 border border-white/20 dark:border-slate-600/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              Room Management
            </h2>
          </div>
          <form
            onSubmit={createRoom}
            className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-4"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Room Code
              </label>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="ABC123"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Game Type
              </label>
              <select
                value={selectedGameType}
                onChange={(e) => setSelectedGameType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="bingo">🎯 Code Bingo</option>
                <option value="sudoku">📊 Code Sudoku</option>
                <option value="connect4">🔴 Code Connect-4</option>
                <option value="memory">🧠 Code Memory Match</option>
                <option value="race">🏁 Code Race (Debug)</option>
                <option value="crossword">📝 Code Crossword</option>
              </select>
            </div>
            <button
              disabled={loading.createRoom || !roomCode.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold hover:from-purple-600 hover:to-pink-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              {loading.createRoom && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Create/Load Room
            </button>

            <button
              type="button"
              onClick={() => setShowStartTimer(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:from-green-600 hover:to-emerald-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-4 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Start Timer
            </button>
            <button
              type="button"
              onClick={() => setShowExtendTimer(true)}
              disabled={!room}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Extend
            </button>
            <button
              type="button"
              onClick={forceEnd}
              disabled={loading.forceEnd}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold hover:from-red-600 hover:to-rose-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              {loading.forceEnd && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              Force End
            </button>
          </form>
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-xl">
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              Wipe / Purge User Data
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              Use carefully. You must provide the admin secret for production.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={wipeOptions.softDelete}
                  onChange={(e) =>
                    setWipeOptions((prev) => ({
                      ...prev,
                      softDelete: e.target.checked,
                    }))
                  }
                />{" "}
                Soft-delete (mark rows as deleted)
              </label>
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={wipeOptions.purgeQuestions}
                  onChange={(e) =>
                    setWipeOptions((prev) => ({
                      ...prev,
                      purgeQuestions: e.target.checked,
                    }))
                  }
                />{" "}
                Purge questions (delete question rows)
              </label>
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={wipeOptions.purgeRooms}
                  onChange={(e) =>
                    setWipeOptions((prev) => ({
                      ...prev,
                      purgeRooms: e.target.checked,
                    }))
                  }
                />{" "}
                Purge rooms (delete room rows)
              </label>
              <label className="text-sm">
                <input
                  type="text"
                  placeholder="initiated by"
                  value={initiatedBy}
                  onChange={(e) => setInitiatedBy(e.target.value)}
                  className="ml-2 border rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600"
                />{" "}
                Initiated by
              </label>
            </div>

            <div className="mb-3">
              <label className="block text-sm">
                Preserve Rooms (comma-separated)
              </label>
              <input
                value={preserveRoomsText}
                onChange={(e) => setPreserveRoomsText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2 mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="ROOM1,ROOM2"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm">Admin Secret (production)</label>
              <input
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2 mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="secret"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={doWipe}
                disabled={loading.wipe}
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {loading.wipe ? "Wiping..." : "Wipe "}
              </button>
            </div>
          </div>
          {room && (
            <div className="bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-slate-600/50">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Room:
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {room.code}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Title:
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {room.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Ends:
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {room.roundEndAt
                      ? new Date(room.roundEndAt).toLocaleTimeString()
                      : "Not started"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 border border-white/20 dark:border-slate-600/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              Upload Questions File
            </h2>
          </div>
          <div className="mb-4 p-4 bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 rounded-xl">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              File Format Requirements:
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li key="csv-upload">• Upload a CSV file with questions data</li>
              <li key="headers">• First row should be headers</li>
              <li key="required-cols">
                • Required columns:{" "}
                <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                  question_text
                </code>{" "}
                or{" "}
                <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                  Code
                </code>
                , and{" "}
                <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                  correct_answer
                </code>{" "}
                or{" "}
                <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                  Answer
                </code>
              </li>
              <li key="optional-cols">
                • Optional column:{" "}
                <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                  is_real
                </code>{" "}
                or{" "}
                <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                  Difficulty
                </code>{" "}
                (true/false or 1/0, defaults to true)
              </li>
              <li key="commas">• Use quotes around text containing commas</li>
            </ul>
            <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-lg border text-xs font-mono text-gray-600 dark:text-gray-300">
              ID,Code,Answer,Difficulty,Topic
              <br />
              1,"int a=5,b=3; printf('%d',a+b);",8,easy,Basics
              <br />
              2,"float x=5.0/2; printf('%.1f',x);",2.5,easy,Basics
            </div>
          </div>
          <form onSubmit={uploadQuestions} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select CSV File
              </label>
              <input
                type="file"
                name="file"
                accept=".csv"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
              />
            </div>
            <button
              disabled={loading.uploadQuestions || !room}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:from-amber-600 hover:to-orange-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              {loading.uploadQuestions && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Upload Questions File
            </button>
          </form>
        </section>

        <section className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 border border-white/20 dark:border-slate-600/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              Add Question
            </h2>
          </div>
          <form
            onSubmit={addQuestion}
            className="grid grid-cols-1 md:grid-cols-6 gap-4"
          >
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Question Code
              </label>
              <textarea
                name="qt"
                required
                placeholder="Paste full C code here (question)."
                rows={8}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-white/70 backdrop-blur-sm font-mono whitespace-pre-wrap focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Expected Output
              </label>
              <input
                name="ans"
                required
                placeholder="Correct output"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="md:col-span-1 flex flex-col justify-end">
              <label className="flex items-center gap-3 p-4 bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm rounded-xl border border-white/20 dark:border-slate-600/50 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  name="is_real"
                  defaultChecked
                  className="w-4 h-4 accent-emerald-600 rounded focus:ring-emerald-500"
                />
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Real Code
                  </span>
                </div>
              </label>
            </div>
            <div className="md:col-span-6">
              <button
                disabled={loading.addQuestion}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                {loading.addQuestion && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add Question
              </button>
            </div>
          </form>
        </section>

        <section className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 border border-white/20 dark:border-slate-600/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                Questions ({state?.questions.length || 0})
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm font-medium text-emerald-700">
                  Real: {realCount}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 rounded-full">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-sm font-medium text-amber-700">
                  Fake: {fakeCount}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state?.questions.map((q) => (
              <div
                key={q.question_id}
                className="bg-white/70 dark:bg-slate-700/70 backdrop-blur-sm border border-white/30 dark:border-slate-600/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {q.is_real ? (
                      <div className="flex items-center gap-2 px-2 py-1 bg-emerald-100 rounded-full">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs font-medium text-emerald-700">
                          Real
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1 bg-amber-100 rounded-full">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span className="text-xs font-medium text-amber-700">
                          Fake
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteQuestion(q.question_id)}
                    disabled={loading[`deleteQuestion_${q.question_id}`]}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm hover:from-red-600 hover:to-rose-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:scale-105"
                  >
                    {loading[`deleteQuestion_${q.question_id}`] && (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete
                  </button>
                </div>
                <pre className="text-sm text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap bg-slate-50/50 rounded-lg p-3 border border-slate-200/50 mb-3">
                  {q.question_text}
                </pre>
                <div className="flex items-center gap-2 text-xs">
                  <svg
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Answer:
                  </span>
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200">
                    {q.correct_answer}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-br from-rose-50 via-pink-50 to-red-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 border border-white/20 dark:border-slate-600/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              Teams
            </h2>
          </div>
          <div className="bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm rounded-xl border border-white/30 dark:border-slate-600/50 overflow-hidden">
            <div className="grid grid-cols-4 gap-0 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold text-sm">
              <div className="px-6 py-3">Team Name</div>
              <div className="px-6 py-3">Lines Completed</div>
              <div className="px-6 py-3">Started</div>
              <div className="px-6 py-3">Ended</div>
            </div>
            {state?.teams.map((t) => (
              <div
                key={t.team_id}
                className="grid grid-cols-4 gap-0 border-b border-white/20 dark:border-slate-600/50 last:border-b-0 hover:bg-white/40 dark:hover:bg-slate-700/40 transition-colors"
              >
                <div className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                  {t.team_name}
                </div>
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {t.lines_completed}
                      </span>
                    </div>
                    <span className="text-slate-700 font-medium">lines</span>
                  </div>
                </div>
                <div className="px-6 py-4 text-sm text-slate-600">
                  {new Date(t.start_time).toLocaleTimeString()}
                </div>
                <div className="px-6 py-4 text-sm">
                  {t.end_time ? (
                    <span className="text-emerald-700 font-medium">
                      {new Date(t.end_time).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">In progress</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {showStartTimer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-96 shadow-2xl border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                Start Timer for All Rooms
              </h3>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(e.target.value)}
                placeholder="Enter minutes"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50/50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                min="1"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={startTimer}
                disabled={loading.startTimer || !timerMinutes}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 font-semibold"
              >
                {loading.startTimer && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-4 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Start Timer
              </button>
              <button
                onClick={() => {
                  setShowStartTimer(false);
                  setTimerMinutes("");
                }}
                className="flex-1 border border-slate-200 py-3 rounded-xl hover:bg-slate-50 transition-all font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showExtendTimer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-96 shadow-2xl border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                Extend Timer for All Rooms
              </h3>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Additional Minutes
              </label>
              <input
                type="number"
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(e.target.value)}
                placeholder="Enter minutes to add"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                min="1"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={extendTimer}
                disabled={loading.extendTimer || !timerMinutes}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 font-semibold"
              >
                {loading.extendTimer && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Extend Timer
              </button>
              <button
                onClick={() => {
                  setShowExtendTimer(false);
                  setTimerMinutes("");
                }}
                className="flex-1 border border-slate-200 py-3 rounded-xl hover:bg-slate-50 transition-all font-semibold"
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
