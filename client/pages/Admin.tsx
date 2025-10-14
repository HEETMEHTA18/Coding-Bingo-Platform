export default function AdminPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-600 mt-2">Rooms • Teams • Questions • Leaderboard • Timer</p>
        <p className="text-slate-500 mt-4 text-sm">
          This is a placeholder. Ask to build full admin features: create rooms, import questions, mark 25 real/10 fake,
          assign bingo mapping, extend timer, monitor progress, and export results.
        </p>
        <a href="/" className="inline-block mt-6 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90">Go Home</a>
      </div>
    </div>
  );
}
