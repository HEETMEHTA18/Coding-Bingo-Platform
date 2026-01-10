import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  AdminAddQuestionRequest,
  AdminCreateRoomRequest,
  AdminStateResponse,
  Room,
} from "@shared/api";
import { apiFetch } from "../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

interface RoomWithCounts extends Room {
  questionCount: number;
  teamCount: number;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [selectedGameType, setSelectedGameType] = useState<string>("bingo");
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [roomsList, setRoomsList] = useState<RoomWithCounts[]>([]);

  useEffect(() => {
    const isAdmin = localStorage.getItem("bingo.admin") === "true";
    if (!isAdmin) navigate("/");
  }, [navigate]);

  const load = async (code: string) => {
    try {
      const res = await apiFetch(
        `/api/admin/state?room=${encodeURIComponent(code)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as AdminStateResponse;
        console.log('Admin state loaded:', data);
        console.log('Sample question:', data.questions[0]);
        setState(data);
      } else {
        console.error('Failed to load admin state:', res.status);
        setState(null);
      }
    } catch (error) {
      console.error('Error loading admin state:', error);
      setState(null);
    }
  };

  const loadRooms = async () => {
    try {
      const res = await apiFetch("/api/admin/rooms");
      if (res.ok) {
        const data = await res.json();
        setRoomsList(data.rooms);
      }
    } catch (error) {
      console.error("Error loading rooms:", error);
    }
  };

  useEffect(() => {
    if (roomCode) {
      load(roomCode);
    }
    loadRooms();
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
      await loadRooms();
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
    console.log('Deleting question:', { id, room: roomCode });
    setLoading((prev) => ({ ...prev, [`deleteQuestion_${id}`]: true }));
    try {
      const res = await apiFetch("/api/admin/delete-question", {
        method: "POST",
        // server accepts questionId (camelCase); send that to avoid 400s
        body: JSON.stringify({ room: roomCode.toUpperCase(), questionId: id }),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error('Delete failed:', error);
        alert(`Failed to delete: ${error.error || 'Unknown error'}`);
        return;
      }
      await load(roomCode);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete question');
    } finally {
      setLoading((prev) => ({ ...prev, [`deleteQuestion_${id}`]: false }));
    }
  };

  const deleteRoom = async (code: string) => {
    if (!confirm(`Are you sure you want to delete room ${code}? This will delete ALL data for this room.`)) return;
    setLoading((prev) => ({ ...prev, [`deleteRoom_${code}`]: true }));
    try {
      await apiFetch("/api/admin/delete-room", {
        method: "POST",
        body: JSON.stringify({ room: code }),
      });
      await loadRooms();
      if (roomCode === code) {
        setRoomCode("");
        setState(null);
      }
    } finally {
      setLoading((prev) => ({ ...prev, [`deleteRoom_${code}`]: false }));
    }
  };

  const deleteAllRooms = async () => {
    if (!confirm("Are you sure you want to delete ALL rooms? This is extremely destructive.")) return;
    setLoading((prev) => ({ ...prev, deleteAllRooms: true }));
    try {
      await apiFetch("/api/admin/delete-all-rooms", {
        method: "POST",
      });
      await loadRooms();
      setRoomCode("");
      setState(null);
    } finally {
      setLoading((prev) => ({ ...prev, deleteAllRooms: false }));
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) return;
    setLoading((prev) => ({ ...prev, [`deleteTeam_${teamId}`]: true }));
    try {
      await apiFetch("/api/admin/delete-team", {
        method: "POST",
        body: JSON.stringify({ room: roomCode, teamId }),
      });
      await load(roomCode);
    } finally {
      setLoading((prev) => ({ ...prev, [`deleteTeam_${teamId}`]: false }));
    }
  };

  const deleteAllTeams = async () => {
    if (!confirm("Are you sure you want to delete ALL teams? This action cannot be undone.")) return;
    setLoading((prev) => ({ ...prev, deleteAllTeams: true }));
    try {
      await apiFetch("/api/admin/delete-all-teams", {
        method: "POST",
        body: JSON.stringify({ room: roomCode }),
      });
      await load(roomCode);
    } finally {
      setLoading((prev) => ({ ...prev, deleteAllTeams: false }));
    }
  };

  const [showFakeQuestionDialog, setShowFakeQuestionDialog] = useState(false);
  const [fakeQuestionCount, setFakeQuestionCount] = useState(0);
  const [uploadedRealCount, setUploadedRealCount] = useState(0);
  const [numRandomFakeQuestions, setNumRandomFakeQuestions] = useState("");

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

      // Add numRandomFake parameter if specified
      const numRandomFake = parseInt(numRandomFakeQuestions);
      if (!isNaN(numRandomFake) && numRandomFake > 0) {
        fileData.append("numRandomFake", numRandomFake.toString());
      }

      const response = await apiFetch("/api/admin/upload-questions", {
        method: "POST",
        body: fileData,
      });
      const result = await response.json();
      if (result.success) {
        setUploadedRealCount(result.importedCount);
        setFakeQuestionCount(0);
        setShowFakeQuestionDialog(true);
        (e.target as HTMLFormElement).reset();
        setNumRandomFakeQuestions("");
      } else {
        alert(`Error: ${result.error}`);
      }
    } finally {
      setLoading((prev) => ({ ...prev, uploadQuestions: false }));
    }
  };

  const generateFakeQuestions = async () => {
    if (fakeQuestionCount <= 0) {
      alert("Please enter a valid number of fake questions");
      return;
    }
    setLoading((prev) => ({ ...prev, generateFake: true }));
    try {
      const body = {
        room: roomCode.toUpperCase(),
        count: fakeQuestionCount,
      };
      const response = await apiFetch("/api/admin/generate-fake-questions", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Successfully generated ${fakeQuestionCount} fake questions!`);
        setShowFakeQuestionDialog(false);
        setFakeQuestionCount(0);
        await load(roomCode);
      } else {
        alert(`Error: ${result.error}`);
      }
    } finally {
      setLoading((prev) => ({ ...prev, generateFake: false }));
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-purple-950/20 to-slate-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"></div>
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>
      
      <header className="sticky top-0 z-50 bg-slate-900/70 backdrop-blur-2xl border-b border-purple-500/20 shadow-[0_4px_30px_rgba(139,92,246,0.15)]">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl ring-2 ring-purple-400/30 group-hover:ring-purple-400/50 transition-all">
                <span className="text-2xl">🎮</span>
              </div>
            </div>
            <div>
              <h1 className="font-black text-2xl md:text-3xl bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
                Game Control Center
              </h1>
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="hidden sm:inline">Command Center • </span>Manage Games & Teams
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/40 backdrop-blur-xl rounded-2xl p-2 border border-purple-500/20 shadow-[0_0_30px_rgba(139,92,246,0.1)] hover:shadow-[0_0_40px_rgba(139,92,246,0.15)] transition-all duration-300">
              <a
                href={`/leaderboard?room=${encodeURIComponent(roomCode.toUpperCase())}`}
                className="group relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25 hover:shadow-xl transform hover:-translate-y-1 hover:scale-105 border border-cyan-400/30"
                title="View Room Leaderboard"
              >
                <span className="text-lg group-hover:animate-bounce">🏆</span>
                <span className="hidden sm:inline">Leaderboard</span>
              </a>

              <a
                href="/leaderboard-all"
                className="group relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:from-emerald-500 hover:to-teal-500 transition-all duration-300 shadow-lg hover:shadow-emerald-500/25 hover:shadow-xl transform hover:-translate-y-1 hover:scale-105 border border-emerald-400/30"
                title="View All Rooms"
              >
                <span className="text-lg group-hover:animate-spin">🌍</span>
                <span className="hidden sm:inline">All Rooms</span>
              </a>

              <div className="w-px h-8 bg-gradient-to-b from-transparent via-purple-500/50 to-transparent mx-1"></div>

              <button
                onClick={() => {
                  localStorage.removeItem("bingo.admin");
                  localStorage.removeItem("bingo.role");
                  localStorage.removeItem("bingo.sessionToken");
                  navigate("/");
                }}
                className="group relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 text-white font-bold hover:from-red-500 hover:via-rose-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-red-500/25 hover:shadow-xl transform hover:-translate-y-1 hover:scale-105 border border-red-400/30"
                title="Logout"
              >
                <span className="text-lg group-hover:rotate-12 transition-transform">🚀</span>
                <span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8 relative z-10">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="group relative bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Active Rooms</p>
              <p className="text-3xl font-black text-white mt-1">{roomsList.length}</p>
            </div>
            <div className="absolute top-4 right-4 text-2xl opacity-30 group-hover:opacity-60 transition-opacity">🏠</div>
          </div>
          <div className="group relative bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 border border-cyan-500/20 hover:border-cyan-500/40 transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Total Teams</p>
              <p className="text-3xl font-black text-white mt-1">{state?.teams.length || 0}</p>
            </div>
            <div className="absolute top-4 right-4 text-2xl opacity-30 group-hover:opacity-60 transition-opacity">👥</div>
          </div>
          <div className="group relative bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 border border-amber-500/20 hover:border-amber-500/40 transition-all hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Questions</p>
              <p className="text-3xl font-black text-white mt-1">{state?.questions.length || 0}</p>
            </div>
            <div className="absolute top-4 right-4 text-2xl opacity-30 group-hover:opacity-60 transition-opacity">❓</div>
          </div>
          <div className="group relative bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 border border-emerald-500/20 hover:border-emerald-500/40 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Game Status</p>
              <p className="text-lg font-black text-white mt-1">{room?.roundEndAt ? '🟢 Live' : '⏸️ Idle'}</p>
            </div>
            <div className="absolute top-4 right-4 text-2xl opacity-30 group-hover:opacity-60 transition-opacity">🎮</div>
          </div>
        </div>

        <section className="relative bg-slate-800/30 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/20 shadow-[0_0_50px_rgba(139,92,246,0.1)] overflow-hidden">
          {/* Decorative corner accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-600/20 to-transparent rounded-bl-full"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur-lg opacity-50"></div>
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🏟️</span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                Room Command
              </h2>
              <p className="text-sm text-slate-400">Create and manage game rooms</p>
            </div>
          </div>

          <div className="mb-6 p-5 bg-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <h3 className="font-bold text-white text-lg">Active Game Rooms</h3>
              </div>
              <button
                onClick={deleteAllRooms}
                disabled={loading.deleteAllRooms || !roomsList.length}
                className="group px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 transition-all flex items-center gap-2"
              >
                <span className="group-hover:animate-pulse">🗑️</span>
                {loading.deleteAllRooms ? "Deleting..." : "Clear All"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {roomsList.map((r) => (
                <div
                  key={r.code}
                  className={`group relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${roomCode === r.code
                    ? "bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/60 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                    : "bg-slate-800/40 border-slate-700/50 hover:border-purple-500/40 hover:shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                    }`}
                  onClick={() => setRoomCode(r.code)}
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/5 to-purple-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  
                  <div className="relative flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg text-white tracking-wide">{r.code}</span>
                        {roomCode === r.code && (
                          <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs font-bold rounded-full">SELECTED</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex gap-3 mt-1">
                        <span className="flex items-center gap-1"><span className="text-cyan-400">👥</span> {r.teamCount}</span>
                        <span className="flex items-center gap-1"><span className="text-amber-400">❓</span> {r.questionCount}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      deleteRoom(r.code);
                    }}
                    disabled={loading[`deleteRoom_${r.code}`]}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                    title="Delete Room"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  </div>
                </div>
              ))}
              {!roomsList.length && (
                <div className="col-span-full text-center py-8 text-slate-400">
                  <span className="text-4xl block mb-2">🎮</span>
                  <p className="font-medium">No game rooms yet</p>
                  <p className="text-sm text-slate-500">Create your first room below!</p>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={createRoom}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div className="md:col-span-1">
              <label className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                <span className="text-lg">🏷️</span> Room Code
              </label>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                required
                className="w-full rounded-xl border-2 border-slate-600/50 px-4 py-3.5 bg-slate-900/50 backdrop-blur-sm text-white font-mono font-bold text-lg placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-lg uppercase tracking-wider"
                placeholder="GAME01"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                <span className="text-lg">🎲</span> Game Type
              </label>
              <select
                value={selectedGameType}
                onChange={(e) => setSelectedGameType(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-600/50 px-4 py-3.5 bg-slate-900/50 backdrop-blur-sm text-white font-bold focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-lg cursor-pointer"
              >
                <option value="bingo">🎯 Code Bingo</option>
                <option value="sudoku">📊 Code Sudoku</option>
                <option value="connect4">🔴 Code Connect-4</option>
                <option value="memory">🧠 Code Memory</option>
                <option value="race">🏁 Code Race</option>
                <option value="crossword">📝 Crossword</option>
                <option value="codecanvas">🎨 Canvas</option>
              </select>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-3">
            <button
              disabled={loading.createRoom || !roomCode.trim()}
              className="group relative px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white font-bold hover:from-purple-500 hover:via-fuchsia-500 hover:to-pink-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-purple-500/25 hover:shadow-xl transition-all transform hover:scale-105 overflow-hidden"
            >
              {loading.createRoom && (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <span className="group-hover:scale-110 transition-transform">🚀</span>
              Create/Load
            </button>

            <button
              type="button"
              onClick={() => setShowStartTimer(true)}
              className="group relative px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold hover:from-emerald-500 hover:to-green-500 flex items-center gap-2 shadow-lg hover:shadow-emerald-500/25 hover:shadow-xl transition-all transform hover:scale-105"
            >
              <span className="group-hover:animate-pulse">▶️</span>
              Start
            </button>
            <button
              type="button"
              onClick={() => setShowExtendTimer(true)}
              disabled={!room}
              className="group relative px-5 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-cyan-500/25 hover:shadow-xl transition-all transform hover:scale-105"
            >
              <span className="group-hover:rotate-45 transition-transform">⏱️</span>
              Extend
            </button>
            <button
              type="button"
              onClick={forceEnd}
              disabled={loading.forceEnd}
              className="group relative px-5 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-red-500/25 hover:shadow-xl transition-all transform hover:scale-105"
            >
              {loading.forceEnd ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span className="group-hover:scale-125 transition-transform">⏹️</span>
              )}
              End Game
            </button>
            </div>
          </form>
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl backdrop-blur-sm">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Question Management & Cleanup
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-4">
              Manage questions for this room. Delete individual questions or clear all questions to start fresh.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <button
                onClick={async () => {
                  if (confirm("Delete ALL questions in this room? This cannot be undone.")) {
                    setLoading((prev) => ({ ...prev, deleteAllQuestions: true }));
                    try {
                      await apiFetch("/api/admin/delete-all-questions", {
                        method: "POST",
                        body: JSON.stringify({ room: roomCode.toUpperCase() }),
                      });
                      alert("All questions deleted successfully!");
                      await load(roomCode);
                    } finally {
                      setLoading((prev) => ({ ...prev, deleteAllQuestions: false }));
                    }
                  }
                }}
                disabled={loading.deleteAllQuestions || !state?.questions.length}
                className="px-4 py-3 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold hover:from-red-700 hover:to-rose-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete All
              </button>

              <button
                onClick={async () => {
                  if (confirm("Delete all REAL questions? Fake questions will remain.")) {
                    setLoading((prev) => ({ ...prev, deleteRealQuestions: true }));
                    try {
                      await apiFetch("/api/admin/delete-questions-by-type", {
                        method: "POST",
                        body: JSON.stringify({ room: roomCode.toUpperCase(), type: "real" }),
                      });
                      alert("All real questions deleted successfully!");
                      await load(roomCode);
                    } finally {
                      setLoading((prev) => ({ ...prev, deleteRealQuestions: false }));
                    }
                  }
                }}
                disabled={loading.deleteRealQuestions || !realCount}
                className="px-4 py-3 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold hover:from-orange-700 hover:to-amber-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Delete Real ({realCount})
              </button>

              <button
                onClick={async () => {
                  if (confirm("Delete all FAKE questions? Real questions will remain.")) {
                    setLoading((prev) => ({ ...prev, deleteFakeQuestions: true }));
                    try {
                      await apiFetch("/api/admin/delete-questions-by-type", {
                        method: "POST",
                        body: JSON.stringify({ room: roomCode.toUpperCase(), type: "fake" }),
                      });
                      alert("All fake questions deleted successfully!");
                      await load(roomCode);
                    } finally {
                      setLoading((prev) => ({ ...prev, deleteFakeQuestions: false }));
                    }
                  }
                }}
                disabled={loading.deleteFakeQuestions || !fakeCount}
                className="px-4 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Delete Fake ({fakeCount})
              </button>
            </div>

            <div className="p-3 bg-white/30 dark:bg-slate-900/30 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
              <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                💡 Tip: Upload a CSV with real questions, then generate random fake questions to mix in. This keeps players on their toes!
              </p>
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

        <section className="relative bg-slate-800/30 backdrop-blur-xl rounded-3xl p-6 border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.08)] overflow-hidden">
          {/* Decorative corner accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-600/20 to-transparent rounded-bl-full"></div>
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur-lg opacity-50"></div>
                <div className="relative w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">👥</span>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">
                  Team Roster
                </h2>
                <p className="text-sm text-slate-400">{state?.teams.length || 0} teams in this room</p>
              </div>
            </div>
            <button
              onClick={deleteAllTeams}
              disabled={loading.deleteAllTeams || !state?.teams.length}
              className="group px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-red-500/30 hover:border-red-500/50 flex items-center gap-2"
            >
              <span className="group-hover:animate-pulse">🗑️</span>
              {loading.deleteAllTeams ? "Clearing..." : "Clear All"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state?.teams.map((team: any, index: number) => (
              <div key={team.id} className="group relative bg-slate-900/50 backdrop-blur-sm p-4 rounded-xl border-2 border-slate-700/50 hover:border-cyan-500/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] overflow-hidden">
                {/* Rank badge */}
                <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-bl-xl flex items-center justify-center text-white text-xs font-black shadow-lg">
                  #{index + 1}
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg text-white flex items-center gap-2">
                      {team.isWinner && <span className="text-amber-400">🏆</span>}
                      {team.name}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-full">ID: {team.id.slice(0, 8)}...</span>
                      <span className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded-full font-bold">🎯 {team.lines_completed || 0} pts</span>
                    </div>
                  </div>
                <button
                  onClick={() => deleteTeam(team.id)}
                  disabled={loading[`deleteTeam_${team.id}`]}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-110"
                  title="Delete Team"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                </div>
              </div>
            ))}
            {!state?.teams.length && (
              <div className="col-span-full text-center py-12 text-slate-400">
                <span className="text-5xl block mb-3">👥</span>
                <p className="font-bold text-lg">No teams yet</p>
                <p className="text-sm text-slate-500">Teams will appear here when they join the room</p>
              </div>
            )}
          </div>
        </section>

        <section className="relative bg-slate-800/30 backdrop-blur-xl rounded-3xl p-6 border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.08)] overflow-hidden">
          {/* Decorative corner accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-600/20 to-transparent rounded-bl-full"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl blur-lg opacity-50"></div>
              <div className="relative w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📤</span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                Upload Questions
              </h2>
              <p className="text-sm text-slate-400">Import questions from CSV file</p>
            </div>
          </div>
          <div className="mb-4 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl">
            <h3 className="font-bold text-amber-400 mb-2 flex items-center gap-2">
              <span>📋</span> File Format Requirements:
            </h3>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Upload a CSV file with questions data</li>
              <li>• First row should be headers</li>
              <li>
                • Required columns:{" "}
                <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                  question_text
                </code>{" "}
                or{" "}
                <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-mono">
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
              <li>
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
              <li>• Use quotes around text containing commas</li>
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
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Random Fake Questions (Optional)
              </label>
              <input
                type="number"
                min="0"
                placeholder="Number of questions to randomly mark as fake"
                value={numRandomFakeQuestions}
                onChange={(e) => setNumRandomFakeQuestions(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                📌 Randomly mark this many uploaded questions as fake instead of all real
              </p>
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
                onClick={() => setSelectedQuestion(q)}
                className="bg-white/70 dark:bg-slate-700/70 backdrop-blur-sm border border-white/30 dark:border-slate-600/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer"
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
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuestion(q.question_id);
                    }}
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
                <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200/50 dark:border-slate-600/50 mb-3 overflow-hidden">
                  <code className="text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre block overflow-x-auto">
                    {q.question_text}
                  </code>
                </div>
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
                  <code className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200 text-xs">
                    {q.correct_answer}
                  </code>
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

      {showFakeQuestionDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 w-96 shadow-2xl ring-1 ring-slate-600/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">
                Generate Fake Questions
              </h3>
            </div>

            <p className="text-sm text-slate-300 mb-4">
              Successfully uploaded <span className="font-semibold text-green-400">{uploadedRealCount} real questions</span>. How many fake questions would you like to generate to mix things up?
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Number of Fake Questions
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={fakeQuestionCount}
                onChange={(e) => setFakeQuestionCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl border border-slate-600/50 px-4 py-3 bg-slate-700/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 focus:bg-slate-700/60 transition-all shadow-lg"
                placeholder="e.g. 20"
              />
              <p className="text-xs text-slate-400 mt-2">
                Recommended: Generate 1-2x the number of real questions (e.g., if you have 35 real, generate 35-70 fake)
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={generateFakeQuestions}
                disabled={loading.generateFake || fakeQuestionCount <= 0}
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform hover:scale-105 border border-violet-400/30 hover:border-violet-400/60"
              >
                {loading.generateFake && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {loading.generateFake ? "Generating..." : "✨ Generate"}
              </button>
              <button
                onClick={() => {
                  setShowFakeQuestionDialog(false);
                  setFakeQuestionCount(0);
                  setUploadedRealCount(0);
                }}
                disabled={loading.generateFake}
                className="flex-1 border border-slate-600/50 text-slate-300 hover:text-white hover:border-slate-500 py-3 rounded-xl transition-all font-semibold disabled:opacity-60"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Details Modal */}
      <Dialog open={!!selectedQuestion} onOpenChange={(open) => !open && setSelectedQuestion(null)}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border border-slate-600/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl">Question Details</DialogTitle>
            <DialogDescription className="text-slate-300">
              View the full question and answer
            </DialogDescription>
          </DialogHeader>
          {selectedQuestion && (
            <div className="space-y-6">
              {/* Question Type Badge */}
              <div className="flex items-center gap-2">
                {selectedQuestion.is_real ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-full">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    <span className="text-sm font-semibold text-emerald-300">Real Question</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-full">
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                    <span className="text-sm font-semibold text-amber-300">Fake Question</span>
                  </div>
                )}
                <span className="text-xs text-slate-400 ml-auto">ID: {selectedQuestion.question_id}</span>
              </div>

              {/* Question Text */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Question</h3>
                <div className="bg-slate-900/70 border border-slate-500 rounded-lg p-5 overflow-auto max-h-96">
                  <code className="text-sm text-white font-mono whitespace-pre block">
                    {selectedQuestion.question_text || selectedQuestion.text || 'No question text available'}
                  </code>
                </div>
              </div>

              {/* Answer */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Correct Answer</h3>
                <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-400 rounded-lg p-5">
                  <code className="text-lg font-mono font-bold text-emerald-200 whitespace-pre block">
                    {selectedQuestion.correct_answer || selectedQuestion.correctAnswer || 'No answer available'}
                  </code>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-600/50">
                <button
                  onClick={() => {
                    deleteQuestion(selectedQuestion.question_id);
                    setSelectedQuestion(null);
                  }}
                  disabled={loading[`deleteQuestion_${selectedQuestion.question_id}`]}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold hover:from-red-600 hover:to-rose-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                  {loading[`deleteQuestion_${selectedQuestion.question_id}`] && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Question
                </button>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-500 text-slate-200 font-semibold hover:border-slate-400 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
