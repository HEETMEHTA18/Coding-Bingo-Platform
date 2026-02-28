import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ErrorResponse, LoginRequest, LoginResponse, AuthLoginRequest, AuthLoginResponse } from "@shared/api";
import { apiFetch } from "../lib/api";
import { clearGameData, saveGameData, setAdmin } from "../lib/localStorage";

/* ─────────────── Particle canvas background ───────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.alpha})`;
        ctx.fill();
      });

      // Connect nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(139,92,246,${0.07 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

/* ─────────────── Typing animation ─────────────────────────────── */
function TypingText({ texts }: { texts: string[] }) {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = texts[idx % texts.length];
    let timeout: ReturnType<typeof setTimeout>;
    if (!deleting) {
      if (displayed.length < full.length) {
        timeout = setTimeout(() => setDisplayed(full.slice(0, displayed.length + 1)), 60);
      } else {
        timeout = setTimeout(() => setDeleting(true), 2000);
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 35);
      } else {
        setDeleting(false);
        setIdx((i) => i + 1);
      }
    }
    return () => clearTimeout(timeout);
  }, [displayed, deleting, idx, texts]);

  return (
    <span>
      {displayed}
      <span className="inline-block w-0.5 h-5 bg-purple-400 ml-0.5 animate-pulse" />
    </span>
  );
}

/* ─────────────── Main Page ─────────────────────────────────────── */
export default function Index() {
  const navigate = useNavigate();
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("bingo.team");
    const isAdmin = localStorage.getItem("bingo.admin");
    if (isAdmin === "true") { navigate("/admin"); return; }
    try {
      const parsed = saved && saved !== "undefined" && saved !== "null" ? JSON.parse(saved) : null;
      if (parsed?.team_id) navigate("/game");
    } catch { }
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isAdminLogin) {
      if (!username.trim() || !password.trim()) { setError("Username and password required"); return; }
      setLoading(true);
      try {
        const res = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: username.trim(), password: password.trim() } as AuthLoginRequest),
        });
        if (res.ok) {
          const data = (await res.json()) as AuthLoginResponse;
          if (data.success && data.admin) {
            clearGameData(); setAdmin(true);
            if (data.sessionToken) localStorage.setItem("bingo.sessionToken", data.sessionToken);
            if (data.admin.role) localStorage.setItem("bingo.role", data.admin.role);
            navigate(data.admin.role === "superadmin" ? "/superadmin" : "/admin");
            return;
          }
          setError(data.error || "Login failed");
        } else {
          const d = await res.json().catch(() => ({}));
          setError((d as any).error || "Login failed");
        }
      } catch { setError("Network error"); }
      finally { setLoading(false); }
    } else {
      if (!teamName.trim()) { setError("Team name is required"); return; }
      if (!roomCode.trim()) { setError("Room code is required"); return; }
      setLoading(true);
      try {
        clearGameData();
        const res = await apiFetch("/api/login", {
          method: "POST",
          body: JSON.stringify({ team_name: teamName.trim(), room_code: roomCode.trim() } as LoginRequest),
        });
        const data = (await res.json()) as LoginResponse | ErrorResponse;
        if (!res.ok || ("ok" in data && data.ok === false)) {
          setError((data as ErrorResponse).error || "Login failed");
          return;
        }
        saveGameData((data as LoginResponse).team, (data as LoginResponse).room);
        navigate("/game");
      } catch { setError("Network error"); }
      finally { setLoading(false); }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,40,217,0.25) 0%,transparent 60%), radial-gradient(ellipse 60% 40% at 80% 110%, rgba(6,182,212,0.1) 0%,transparent 50%), hsl(224,20%,5%)" }}>

      {/* ── Particle Background ── */}
      <ParticleCanvas />

      {/* ── Grid overlay ── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* ── Scan line ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ height: "2px", background: "linear-gradient(90deg,transparent,rgba(139,92,246,0.3),transparent)", animation: "scanY 6s linear infinite" }} />
      </div>

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500 rounded-lg blur-lg opacity-40 animate-pulse" />
            <div className="relative w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-lg shadow-lg">⚔️</div>
          </div>
          <div>
            <p className="text-xs text-purple-400 font-mono tracking-widest">COMBAT BINGO</p>
            <p className="text-[10px] text-slate-600 font-mono">v2.0 · ARENA ONLINE</p>
          </div>
        </div>

      </div>

      {/* ── Main content ── */}
      <div className={`w-full max-w-5xl mx-auto px-4 pt-24 pb-8 flex flex-col lg:flex-row gap-12 items-center z-10 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>

        {/* LEFT — Hero text */}
        <div className="flex-1 text-center lg:text-left space-y-6">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 justify-center lg:justify-start">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-mono text-green-400 tracking-widest uppercase">ARENA LIVE — JOIN NOW</span>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-6xl lg:text-7xl font-black tracking-tight leading-none"
              style={{ fontFamily: "'Orbitron', sans-serif" }}>
              <span className="block bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">CODE</span>
              <span className="block bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(168,85,247,0.5)]">BINGO</span>
              <span className="block text-4xl lg:text-5xl text-slate-400">ARENA</span>
            </h1>
          </div>

          {/* Typing subtitle */}
          <p className="text-lg text-slate-400 font-mono min-h-[28px]">
            <TypingText texts={[
              "Solve. Strike. Dominate.",
              "Code your way to victory.",
              "Real-time coding battles.",
              "Challenge accepted?",
            ]} />
          </p>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
            {[
              { icon: "⚡", label: "Real-time sync" },
              { icon: "🎯", label: "Combat TTT" },
              { icon: "💻", label: "Live Compiler" },
              { icon: "🏆", label: "Leaderboard" },
            ].map((f) => (
              <span key={f.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium backdrop-blur-sm hover:border-purple-500/60 hover:bg-purple-500/20 transition-all cursor-default">
                {f.icon} {f.label}
              </span>
            ))}
          </div>

          {/* Corner decoration */}
          <div className="hidden lg:block relative h-32 mt-4">
            <div className="absolute left-0 bottom-0 text-[120px] leading-none select-none pointer-events-none"
              style={{ opacity: 0.04, fontFamily: "'Orbitron', monospace", fontWeight: 900, letterSpacing: "-0.1em" }}>
              BINGO
            </div>
          </div>
        </div>

        {/* RIGHT — Login card */}
        <div className="w-full max-w-md">
          {/* Card glow ring */}
          <div className="relative rounded-2xl">
            <div className="absolute -inset-px rounded-2xl"
              style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.5), rgba(6,182,212,0.2), rgba(139,92,246,0.1))", filter: "blur(1px)" }} />

            <form onSubmit={submit}
              className="relative rounded-2xl p-8 space-y-5 backdrop-blur-2xl"
              style={{ background: "rgba(10,10,18,0.85)", border: "1px solid rgba(139,92,246,0.25)" }}>

              {/* Card header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(139,92,246,0.5))" }} />
                <span className="text-[10px] font-mono tracking-[0.3em] text-purple-400 uppercase">
                  {isAdminLogin ? "COMMAND ACCESS" : "ENTER ARENA"}
                </span>
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,rgba(139,92,246,0.5),transparent)" }} />
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-slate-800 p-0.5 gap-0.5" style={{ background: "rgba(0,0,0,0.4)" }}>
                {[
                  { label: "🎮 Player Join", value: false },
                  { label: "⚙️ Admin", value: true },
                ].map((opt) => (
                  <button key={String(opt.value)} type="button"
                    onClick={() => { setIsAdminLogin(opt.value); setError(""); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider transition-all duration-300 ${isAdminLogin === opt.value
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20"
                      : "text-slate-500 hover:text-slate-300"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Fields */}
              {!isAdminLogin ? (
                <>
                  <Field icon="👾" label="TEAM NAME" placeholder="e.g. Code Ninjas"
                    value={teamName} onChange={setTeamName} />
                  <Field icon="🔐" label="ROOM CODE" placeholder="e.g. ABC123"
                    value={roomCode} onChange={(v) => setRoomCode(v.toUpperCase())} mono uppercase />
                </>
              ) : (
                <>
                  <Field icon="👤" label="USERNAME" placeholder="admin"
                    value={username} onChange={setUsername} />
                  <Field icon="🔑" label="PASSWORD" placeholder="••••••••"
                    value={password} onChange={setPassword}
                    type={showPassword ? "text" : "password"}
                    rightAction={
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-purple-400 transition-colors text-sm">
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    } />
                </>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-300 border border-red-500/30 animate-shake"
                  style={{ background: "rgba(239,68,68,0.08)" }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-xl font-black text-sm tracking-widest text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 group"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: loading
                    ? "rgba(100,60,200,0.5)"
                    : "linear-gradient(135deg,#7c3aed,#a855f7,#6366f1)",
                  boxShadow: loading ? "none" : "0 0 30px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    CONNECTING...
                  </>
                ) : (
                  <>
                    <span className="group-hover:animate-bounce">🚀</span>
                    {isAdminLogin ? "ACCESS CONTROL" : "JOIN BATTLE"}
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </>
                )}
              </button>

              {/* Bottom links */}
              <div className="flex items-center justify-between pt-1">
                <a href="/leaderboard-all" className="text-[11px] text-slate-600 hover:text-purple-400 transition-colors font-mono">
                  🏆 Leaderboard
                </a>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-500/40 animate-pulse"
                      style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
                <span className="text-[11px] text-slate-700 font-mono">ARENA v2.0</span>
              </div>
            </form>
          </div>

          {/* Under-card tagline */}
          <p className="text-center text-xs text-slate-600 mt-4 font-mono tracking-widest">
            ◆ CODE · BATTLE · CONQUER ◆
          </p>
        </div>
      </div>

      {/* ── Bottom decorative strip ── */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(139,92,246,0.4),rgba(6,182,212,0.4),transparent)" }} />

      <style>{`
        @keyframes scanY {
          0%   { transform: translateY(-4px); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────── Reusable input field ─────────────────────────── */
function Field({
  icon, label, placeholder, value, onChange, type = "text",
  mono, uppercase, rightAction
}: {
  icon: string; label: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  type?: string; mono?: boolean; uppercase?: boolean;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        <span>{icon}</span>{label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 transition-all duration-200 focus:outline-none"
          style={{
            fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
            textTransform: uppercase ? "uppercase" : undefined,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(100,100,140,0.3)",
          }}
          onFocus={(e) => {
            e.target.style.border = "1px solid rgba(139,92,246,0.6)";
            e.target.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.12), 0 0 20px rgba(139,92,246,0.1)";
            e.target.style.background = "rgba(139,92,246,0.06)";
          }}
          onBlur={(e) => {
            e.target.style.border = "1px solid rgba(100,100,140,0.3)";
            e.target.style.boxShadow = "";
            e.target.style.background = "rgba(255,255,255,0.04)";
          }}
        />
        {rightAction}
      </div>
    </div>
  );
}
