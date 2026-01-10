import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

interface Admin {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

interface ActivityLog {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  timestamp: string;
}

interface Session {
  id: number;
  userId: number;
  username: string;
  role: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  createdAt: string;
  lastActiveAt: string;
  isActive: boolean;
}

interface Stats {
  totalRooms: number;
  totalTeams: number;
  totalQuestions: number;
  totalAdmins: number;
  activeSessions: number;
  recentActivities: number;
}

interface Room {
  code: string;
  title: string;
  gameType: string;
  roundEndAt: string | null;
  isDeleted: boolean;
  questionCount?: number;
  teamCount?: number;
}

interface Team {
  teamId: string;
  teamName: string;
  roomCode: string;
  startTime: string;
  linesCompleted: number;
  endTime: string | null;
  isDeleted: boolean;
}

interface Question {
  questionId: number;
  roomCode: string;
  questionText: string;
  isReal: boolean;
  correctAnswer: string;
  isDeleted: boolean;
}

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rooms' | 'teams' | 'questions' | 'admins' | 'logs' | 'sessions'>('dashboard');
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);  const [rooms, setRooms] = useState<Room[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  
  // Dialog states
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [showEditAdmin, setShowEditAdmin] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', role: 'admin' });

  const sessionToken = localStorage.getItem("bingo.sessionToken");

  useEffect(() => {
    const role = localStorage.getItem("bingo.role");
    if (role !== "superadmin") {
      navigate("/admin");
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    await Promise.all([
      loadStats(),
      loadAdmins(),
      loadLogs(),
      loadSessions(),
      loadRooms(),
      loadTeams(),
      loadQuestions()
    ]);
  };

  const loadStats = async () => {
    try {
      const res = await apiFetch("/api/superadmin/stats", {
        headers: { "x-session-token": sessionToken || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const loadAdmins = async () => {
    try {
      const res = await apiFetch("/api/superadmin/admins", {
        headers: { "x-session-token": sessionToken || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins);
      }
    } catch (err) {
      console.error("Failed to load admins:", err);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await apiFetch("/api/superadmin/activity-logs?limit=100", {
        headers: { "x-session-token": sessionToken || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await apiFetch("/api/superadmin/sessions", {
        headers: { "x-session-token": sessionToken || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  const loadRooms = async () => {
    try {
      const res = await apiFetch("/api/admin/rooms", {
        headers: { "x-session-token": sessionToken || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };

  const loadTeams = async () => {
    try {
      const res = await apiFetch("/api/superadmin/teams", {
        headers: { "x-session-token": sessionToken || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error("Failed to load teams:", err);
    }
  };

  const loadQuestions = async () => {
    try {
      const res = await apiFetch("/api/superadmin/questions", {
        headers: { "x-session-token": sessionToken || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error("Failed to load questions:", err);
    }
  };

  const deleteRoom = async (roomCode: string) => {
    if (!confirm("Are you sure you want to delete this room? This will also delete all associated teams and questions.")) return;
    setLoading(prev => ({ ...prev, [`deleteRoom_${roomCode}`]: true }));
    try {
      const res = await apiFetch(`/api/admin/delete-room`, {
        method: "POST",
        headers: { "x-session-token": sessionToken || "" },
        body: JSON.stringify({ room: roomCode })
      });
      if (res.ok) {
        await Promise.all([loadRooms(), loadStats()]);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete room");
      }
    } finally {
      setLoading(prev => ({ ...prev, [`deleteRoom_${roomCode}`]: false }));
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team?")) return;
    setLoading(prev => ({ ...prev, [`deleteTeam_${teamId}`]: true }));
    try {
      const res = await apiFetch(`/api/admin/delete-team`, {
        method: "POST",
        headers: { "x-session-token": sessionToken || "" },
        body: JSON.stringify({ teamId })
      });
      if (res.ok) {
        await Promise.all([loadTeams(), loadStats()]);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete team");
      }
    } finally {
      setLoading(prev => ({ ...prev, [`deleteTeam_${teamId}`]: false }));
    }
  };

  const deleteQuestion = async (questionId: number) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    setLoading(prev => ({ ...prev, [`deleteQuestion_${questionId}`]: true }));
    try {
      const res = await apiFetch(`/api/admin/delete-question`, {
        method: "POST",
        headers: { "x-session-token": sessionToken || "" },
        body: JSON.stringify({ questionId })
      });
      if (res.ok) {
        await Promise.all([loadQuestions(), loadStats()]);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete question");
      }
    } finally {
      setLoading(prev => ({ ...prev, [`deleteQuestion_${questionId}`]: false }));
    }
  };

  const createAdmin = async () => {
    if (!newAdmin.username || !newAdmin.password) return;
    setLoading(prev => ({ ...prev, createAdmin: true }));
    try {
      const res = await apiFetch("/api/superadmin/admins", {
        method: "POST",
        headers: { "x-session-token": sessionToken || "" },
        body: JSON.stringify(newAdmin)
      });
      if (res.ok) {
        setShowCreateAdmin(false);
        setNewAdmin({ username: '', password: '', role: 'admin' });
        await loadAdmins();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create admin");
      }
    } finally {
      setLoading(prev => ({ ...prev, createAdmin: false }));
    }
  };

  const updateAdmin = async () => {
    if (!selectedAdmin) return;
    setLoading(prev => ({ ...prev, updateAdmin: true }));
    try {
      const res = await apiFetch("/api/superadmin/admins", {
        method: "PUT",
        headers: { "x-session-token": sessionToken || "" },
        body: JSON.stringify({
          id: selectedAdmin.id,
          username: selectedAdmin.username,
          role: selectedAdmin.role,
          password: (selectedAdmin as any).newPassword || undefined
        })
      });
      if (res.ok) {
        setShowEditAdmin(false);
        setSelectedAdmin(null);
        await loadAdmins();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update admin");
      }
    } finally {
      setLoading(prev => ({ ...prev, updateAdmin: false }));
    }
  };

  const deleteAdmin = async (admin: Admin) => {
    if (!confirm(`Are you sure you want to delete admin "${admin.username}"?`)) return;
    setLoading(prev => ({ ...prev, [`delete_${admin.id}`]: true }));
    try {
      const res = await apiFetch("/api/superadmin/admins", {
        method: "DELETE",
        headers: { "x-session-token": sessionToken || "" },
        body: JSON.stringify({ id: admin.id })
      });
      if (res.ok) {
        await loadAdmins();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete admin");
      }
    } finally {
      setLoading(prev => ({ ...prev, [`delete_${admin.id}`]: false }));
    }
  };

  const terminateSession = async (sessionId: number) => {
    if (!confirm("Are you sure you want to terminate this session?")) return;
    setLoading(prev => ({ ...prev, [`terminate_${sessionId}`]: true }));
    try {
      const res = await apiFetch("/api/superadmin/terminate-session", {
        method: "POST",
        headers: { "x-session-token": sessionToken || "" },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        await loadSessions();
      }
    } finally {
      setLoading(prev => ({ ...prev, [`terminate_${sessionId}`]: false }));
    }
  };

  const parseDeviceInfo = (deviceInfo: string | null) => {
    if (!deviceInfo) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
    try {
      return JSON.parse(deviceInfo);
    } catch {
      return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('login')) return '🔐';
    if (action.includes('logout')) return '🚪';
    if (action.includes('create')) return '➕';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('update')) return '✏️';
    if (action.includes('terminate')) return '⛔';
    return '📝';
  };

  const getActionColor = (action: string) => {
    if (action.includes('failed')) return 'text-red-600';
    if (action.includes('success') || action.includes('created')) return 'text-emerald-600';
    if (action.includes('delete')) return 'text-orange-600';
    return 'text-blue-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-300/30 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-pink-300/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-purple-200/50 shadow-lg shadow-purple-500/5">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-600 to-red-500 flex items-center justify-center shadow-xl ring-4 ring-purple-100">
                <span className="text-2xl">👑</span>
              </div>
            </div>
            <div>
              <h1 className="font-black text-2xl md:text-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 bg-clip-text text-transparent">
                Super Admin HQ
              </h1>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
                Command Center • Full System Access
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="group relative px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-blue-500/25 hover:scale-105 transform duration-200"
            >
              <span className="group-hover:animate-pulse">🎮</span> Admin Panel
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("bingo.admin");
                localStorage.removeItem("bingo.role");
                localStorage.removeItem("bingo.sessionToken");
                navigate("/");
              }}
              className="group relative px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold hover:from-red-600 hover:to-rose-700 transition-all shadow-lg hover:shadow-red-500/25 hover:scale-105 transform duration-200"
            >
              <span className="group-hover:rotate-12 inline-block transition-transform">🚀</span> Exit
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="container py-6 relative z-10">
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-xl rounded-2xl p-2 border border-purple-200/50 shadow-xl shadow-purple-500/5 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'rooms', label: 'Game Rooms', icon: '🏟️' },
            { id: 'teams', label: 'All Teams', icon: '👥' },
            { id: 'questions', label: 'Questions', icon: '❓' },
            { id: 'admins', label: 'Admins', icon: '🔑' },
            { id: 'logs', label: 'Activity', icon: '📜' },
            { id: 'sessions', label: 'Sessions', icon: '🔌' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-shrink-0 px-4 py-3.5 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 text-white shadow-lg shadow-purple-500/30 scale-[1.02]'
                  : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="container pb-12 space-y-8 relative z-10">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: 'Game Rooms', value: stats?.totalRooms ?? 0, icon: '🏟️', gradient: 'from-blue-500 to-cyan-500', bg: 'from-blue-50 to-cyan-50', border: 'border-blue-200', tab: 'rooms' },
                { label: 'Active Teams', value: stats?.totalTeams ?? 0, icon: '👥', gradient: 'from-emerald-500 to-green-500', bg: 'from-emerald-50 to-green-50', border: 'border-emerald-200', tab: 'teams' },
                { label: 'Questions', value: stats?.totalQuestions ?? 0, icon: '❓', gradient: 'from-purple-500 to-pink-500', bg: 'from-purple-50 to-pink-50', border: 'border-purple-200', tab: 'questions' },
                { label: 'Admin Users', value: stats?.totalAdmins ?? 0, icon: '🔑', gradient: 'from-orange-500 to-red-500', bg: 'from-orange-50 to-red-50', border: 'border-orange-200', tab: 'admins' },
                { label: 'Live Sessions', value: stats?.activeSessions ?? 0, icon: '🔌', gradient: 'from-cyan-500 to-teal-500', bg: 'from-cyan-50 to-teal-50', border: 'border-cyan-200', tab: 'sessions' },
                { label: 'Activity Logs', value: stats?.recentActivities ?? 0, icon: '📝', gradient: 'from-amber-500 to-yellow-500', bg: 'from-amber-50 to-yellow-50', border: 'border-amber-200', tab: 'logs' },
              ].map((stat, index) => (
                <button
                  key={stat.label}
                  onClick={() => setActiveTab(stat.tab as any)}
                  className={`group relative bg-gradient-to-br ${stat.bg} border-2 ${stat.border} rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] overflow-hidden cursor-pointer text-left`}
                >
                  {/* Decorative circle */}
                  <div className={`absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br ${stat.gradient} rounded-full opacity-20 group-hover:opacity-30 transition-opacity`}></div>
                  
                  <div className="relative flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <span className="text-3xl">{stat.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-4xl font-black text-slate-800">{stat.value}</p>
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-4 text-slate-400 group-hover:text-slate-600 transition-colors">
                    <span className="text-xl">→</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-white/70 backdrop-blur-xl border-2 border-purple-200/50 rounded-3xl p-8 shadow-xl">
              <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">⚡</span> Quick Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Add Admin', icon: '➕', onClick: () => { setActiveTab('admins'); setShowCreateAdmin(true); }, gradient: 'from-purple-500 to-pink-500' },
                  { label: 'View Logs', icon: '📜', onClick: () => setActiveTab('logs'), gradient: 'from-blue-500 to-indigo-500' },
                  { label: 'Sessions', icon: '🔌', onClick: () => setActiveTab('sessions'), gradient: 'from-emerald-500 to-teal-500' },
                  { label: 'Leaderboards', icon: '🏆', onClick: () => navigate('/leaderboard-all'), gradient: 'from-amber-500 to-orange-500' },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className={`group relative p-6 rounded-2xl bg-gradient-to-br ${action.gradient} text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span className="text-4xl mb-3 block group-hover:scale-110 transition-transform">{action.icon}</span>
                    <span className="relative text-lg">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-4xl">🏟️</span> All Game Rooms
              </h2>
              <button
                onClick={() => navigate('/admin')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-blue-500/30 hover:scale-105"
              >
                🎮 Manage in Admin Panel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <div
                  key={room.code}
                  className="group relative bg-white/80 backdrop-blur-xl border-2 border-blue-200/50 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full bg-gradient-to-bl from-blue-300/30 to-transparent group-hover:from-blue-400/40 transition-all"></div>
                  
                  <div className="relative space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                          <span className="text-2xl">🏟️</span>
                        </div>
                        <div>
                          <h3 className="font-black text-xl text-slate-800">{room.title}</h3>
                          <span className="text-xs font-bold text-blue-600">
                            🎮 {room.gameType}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="text-base">📟</span>
                      <span>Code: <span className="font-mono font-bold">{room.code}</span></span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="text-base">👥</span>
                      <span>Teams: {room.teamCount || 0} | Questions: {room.questionCount || 0}</span>
                    </div>

                    <button
                      onClick={() => deleteRoom(room.code)}
                      disabled={loading[`deleteRoom_${room.code}`]}
                      className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold hover:from-red-600 hover:to-rose-600 transition-all shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50"
                    >
                      {loading[`deleteRoom_${room.code}`] ? '...' : '🗑️ Delete Room'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {rooms.length === 0 && (
              <div className="text-center py-16 bg-white/60 backdrop-blur-xl rounded-3xl border-2 border-blue-200/50">
                <span className="text-6xl mb-4 block">🏟️</span>
                <p className="text-xl text-slate-400 font-medium">No rooms created yet</p>
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-4xl">👥</span> All Teams
              </h2>
              <button
                onClick={loadTeams}
                className="px-5 py-2.5 rounded-xl bg-white border-2 border-emerald-200 text-emerald-600 font-bold hover:bg-emerald-50 transition-all shadow-md hover:shadow-lg"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="bg-white/80 backdrop-blur-xl border-2 border-emerald-200/50 rounded-3xl overflow-hidden shadow-xl">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-emerald-100 to-green-100">
                  <tr>
                    <th className="px-6 py-5 text-left text-sm font-black text-emerald-700 uppercase tracking-wider">Team ID</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-emerald-700 uppercase tracking-wider">Team Name</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-emerald-700 uppercase tracking-wider">Room Code</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-emerald-700 uppercase tracking-wider">Lines</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-emerald-700 uppercase tracking-wider">Started</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-emerald-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {teams.map((team) => (
                    <tr key={team.teamId} className="hover:bg-emerald-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center justify-center px-3 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold shadow-inner text-xs">
                          {team.teamId.substring(0, 8)}...
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-md">
                            <span className="text-lg">👥</span>
                          </div>
                          <span className="font-bold text-slate-800 text-lg">{team.teamName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-blue-100 text-blue-700 border-2 border-blue-200">
                          🏟️ {team.roomCode}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-2xl font-black text-emerald-600">{team.linesCompleted}</span>
                      </td>
                      <td className="px-6 py-5 text-slate-500 font-medium">
                        {new Date(team.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5">
                        <button
                          onClick={() => deleteTeam(team.teamId)}
                          disabled={loading[`deleteTeam_${team.teamId}`]}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold hover:from-red-600 hover:to-rose-600 transition-all shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50"
                        >
                          {loading[`deleteTeam_${team.teamId}`] ? '...' : '🗑️ Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teams.length === 0 && (
                <div className="text-center py-16">
                  <span className="text-6xl mb-4 block">👥</span>
                  <p className="text-xl text-slate-400 font-medium">No teams found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-4xl">❓</span> All Questions
              </h2>
              <button
                onClick={() => navigate('/admin')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold hover:from-purple-600 hover:to-pink-700 transition-all shadow-lg hover:shadow-purple-500/30 hover:scale-105"
              >
                ➕ Add Questions in Admin
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((question) => (
                <div
                  key={question.questionId}
                  className="group relative bg-white/80 backdrop-blur-xl border-2 border-purple-200/50 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full bg-gradient-to-bl from-purple-300/30 to-transparent group-hover:from-purple-400/40 transition-all"></div>
                  
                  <div className="relative grid md:grid-cols-[1fr,auto] gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
                          <span className="text-2xl">❓</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-black text-lg text-slate-800">{question.questionText}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              question.isReal ? 'bg-green-100 text-green-700 border-2 border-green-200' :
                              'bg-orange-100 text-orange-700 border-2 border-orange-200'
                            }`}>
                              {question.isReal ? '✅ Real' : '🎭 Fake'}
                            </span>
                          </div>
                          <p className="text-slate-600 text-sm">ID: #{question.questionId}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <span className="text-base">🏟️</span>
                          <span className="font-medium">{question.roomCode}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-purple-600">
                          <span className="text-base">✅</span>
                          <span className="font-bold">Answer: {question.correctAnswer}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2 md:justify-center">
                      <button
                        onClick={() => deleteQuestion(question.questionId)}
                        disabled={loading[`deleteQuestion_${question.questionId}`]}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold hover:from-red-600 hover:to-rose-600 transition-all shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading[`deleteQuestion_${question.questionId}`] ? '...' : '🗑️ Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {questions.length === 0 && (
              <div className="text-center py-16 bg-white/60 backdrop-blur-xl rounded-3xl border-2 border-purple-200/50">
                <span className="text-6xl mb-4 block">❓</span>
                <p className="text-xl text-slate-400 font-medium">No questions found</p>
              </div>
            )}
          </div>
        )}

        {/* Admins Tab */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-4xl">🔑</span> Admin Users
              </h2>
              <button
                onClick={() => setShowCreateAdmin(true)}
                className="group px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg hover:shadow-emerald-500/30 hover:scale-105"
              >
                <span className="group-hover:rotate-90 inline-block transition-transform">➕</span> Add New Admin
              </button>
            </div>

            <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200/50 rounded-3xl overflow-hidden shadow-xl">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-100 to-pink-100">
                  <tr>
                    <th className="px-6 py-5 text-left text-sm font-black text-purple-700 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-purple-700 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-purple-700 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-purple-700 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-5 text-left text-sm font-black text-purple-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {admins.map((admin, index) => (
                    <tr key={admin.id} className="hover:bg-purple-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold shadow-inner">
                          #{admin.id}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                            admin.role === 'superadmin' 
                              ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                              : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                          }`}>
                            <span className="text-lg">{admin.role === 'superadmin' ? '👑' : '🔑'}</span>
                          </div>
                          <span className="font-bold text-slate-800 text-lg">{admin.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm ${
                          admin.role === 'superadmin'
                            ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-2 border-purple-300'
                            : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border-2 border-blue-300'
                        }`}>
                          {admin.role === 'superadmin' ? '👑 Super Admin' : '🔑 Admin'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-slate-500 font-medium">
                        {new Date(admin.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedAdmin({ ...admin });
                              setShowEditAdmin(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => deleteAdmin(admin)}
                            disabled={loading[`delete_${admin.id}`] || admin.role === 'superadmin'}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold hover:from-red-600 hover:to-rose-600 transition-all shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                            {loading[`delete_${admin.id}`] ? '...' : '🗑️ Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {admins.length === 0 && (
                <div className="text-center py-16">
                  <span className="text-6xl mb-4 block">👥</span>
                  <p className="text-xl text-slate-400 font-medium">No admins found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-4xl">📜</span> Activity Feed
              </h2>
              <button
                onClick={loadLogs}
                className="px-5 py-2.5 rounded-xl bg-white border-2 border-purple-200 text-purple-600 font-bold hover:bg-purple-50 transition-all shadow-md hover:shadow-lg"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200/50 rounded-3xl overflow-hidden shadow-xl max-h-[700px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-100 to-pink-100 sticky top-0">
                  <tr>
                    <th className="px-5 py-4 text-left text-sm font-black text-purple-700 uppercase tracking-wider">Time</th>
                    <th className="px-5 py-4 text-left text-sm font-black text-purple-700 uppercase tracking-wider">User</th>
                    <th className="px-5 py-4 text-left text-sm font-black text-purple-700 uppercase tracking-wider">Action</th>
                    <th className="px-5 py-4 text-left text-sm font-black text-purple-700 uppercase tracking-wider">Device</th>
                    <th className="px-5 py-4 text-left text-sm font-black text-purple-700 uppercase tracking-wider">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {logs.map((log) => {
                    const device = parseDeviceInfo(log.deviceInfo);
                    return (
                      <tr key={log.id} className="hover:bg-purple-50/50 transition-colors">
                        <td className="px-5 py-4 text-slate-500 text-sm font-medium whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-slate-700">{log.username || 'Unknown'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getActionIcon(log.action)}</span>
                            <span className={`font-bold ${getActionColor(log.action)}`}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{device.device === 'Mobile' ? '📱' : '💻'}</span>
                            <span className="font-medium">{device.browser} / {device.os}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded-lg text-slate-600">
                            {log.ipAddress || 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {logs.length === 0 && (
                <div className="text-center py-16">
                  <span className="text-6xl mb-4 block">📜</span>
                  <p className="text-xl text-slate-400 font-medium">No activity logs yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-4xl">🔌</span> Live Sessions
              </h2>
              <button
                onClick={loadSessions}
                className="px-5 py-2.5 rounded-xl bg-white border-2 border-purple-200 text-purple-600 font-bold hover:bg-purple-50 transition-all shadow-md hover:shadow-lg"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sessions.map((session) => {
                const device = parseDeviceInfo(session.deviceInfo);
                const currentToken = localStorage.getItem("bingo.sessionToken");
                const isCurrentSession = false; // Can't easily compare
                return (
                  <div
                    key={session.id}
                    className={`group relative bg-white/80 backdrop-blur-xl border-2 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden ${
                      isCurrentSession ? 'border-emerald-400 ring-4 ring-emerald-100' : 'border-purple-200/50'
                    }`}
                  >
                    {/* Background decoration */}
                    <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-30 transition-opacity group-hover:opacity-50 ${
                      session.role === 'superadmin' 
                        ? 'bg-gradient-to-bl from-purple-300 to-transparent' 
                        : 'bg-gradient-to-bl from-blue-300 to-transparent'
                    }`}></div>
                    
                    <div className="relative flex items-start justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                          session.role === 'superadmin'
                            ? 'bg-gradient-to-br from-purple-500 to-pink-600'
                            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                        }`}>
                          <span className="text-2xl">{session.role === 'superadmin' ? '👑' : '🔑'}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xl text-slate-800">{session.username}</span>
                            {isCurrentSession && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600 border border-emerald-300">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className={`text-sm font-semibold ${
                            session.role === 'superadmin' ? 'text-purple-600' : 'text-blue-600'
                          }`}>
                            {session.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                          </span>
                        </div>
                      </div>
                      {!isCurrentSession && (
                        <button
                          onClick={() => terminateSession(session.id)}
                          disabled={loading[`terminate_${session.id}`]}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold hover:from-red-600 hover:to-rose-600 transition-all shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50"
                        >
                          {loading[`terminate_${session.id}`] ? '...' : '⛔ End'}
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-600">
                        <span className="text-lg">{device.device === 'Mobile' ? '📱' : '💻'}</span>
                        <span className="font-medium">{device.browser} on {device.os}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600">
                        <span className="text-lg">🌐</span>
                        <span className="font-mono bg-slate-100 px-2 py-1 rounded-lg text-sm">{session.ipAddress || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-sm">
                        <span className="text-lg">⏰</span>
                        <span>Active: {new Date(session.lastActiveAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {sessions.length === 0 && (
              <div className="text-center py-16 bg-white/60 backdrop-blur-xl rounded-3xl border-2 border-purple-200/50">
                <span className="text-6xl mb-4 block">🔌</span>
                <p className="text-xl text-slate-400 font-medium">No active sessions</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Admin Dialog */}
      <Dialog open={showCreateAdmin} onOpenChange={setShowCreateAdmin}>
        <DialogContent className="bg-white border-2 border-purple-200 rounded-3xl shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <span className="text-3xl">➕</span> Create New Admin
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">Username</label>
              <input
                type="text"
                value={newAdmin.username}
                onChange={(e) => setNewAdmin(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-800 font-medium focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">Password</label>
              <input
                type="password"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-800 font-medium focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all"
                placeholder="Enter password"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">Role</label>
              <select
                value={newAdmin.role}
                onChange={(e) => setNewAdmin(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-800 font-medium focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all cursor-pointer"
              >
                <option value="admin">🔑 Admin (Contest Manager)</option>
                <option value="superadmin">👑 Super Admin (Full Access)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowCreateAdmin(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createAdmin}
                disabled={loading.createAdmin || !newAdmin.username || !newAdmin.password}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-lg hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
              >
                {loading.createAdmin ? 'Creating...' : '✨ Create Admin'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={showEditAdmin} onOpenChange={setShowEditAdmin}>
        <DialogContent className="bg-white border-2 border-purple-200 rounded-3xl shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <span className="text-3xl">✏️</span> Edit Admin
            </DialogTitle>
          </DialogHeader>
          {selectedAdmin && (
            <div className="space-y-5 pt-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Username</label>
                <input
                  type="text"
                  value={selectedAdmin.username}
                  onChange={(e) => setSelectedAdmin(prev => prev ? { ...prev, username: e.target.value } : null)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-800 font-medium focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">New Password (leave empty to keep current)</label>
                <input
                  type="password"
                  value={(selectedAdmin as any).newPassword || ''}
                  onChange={(e) => setSelectedAdmin(prev => prev ? { ...prev, newPassword: e.target.value } as any : null)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-800 font-medium focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Role</label>
                <select
                  value={selectedAdmin.role}
                  onChange={(e) => setSelectedAdmin(prev => prev ? { ...prev, role: e.target.value } : null)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-800 font-medium focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all cursor-pointer"
                >
                  <option value="admin">🔑 Admin (Contest Manager)</option>
                  <option value="superadmin">👑 Super Admin (Full Access)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowEditAdmin(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={updateAdmin}
                  disabled={loading.updateAdmin}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                >
                  {loading.updateAdmin ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
