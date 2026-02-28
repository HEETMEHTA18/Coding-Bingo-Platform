import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import { Suspense, lazy } from "react";

// Lazy load pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GameRouter = lazy(() => import("./pages/GameRouter"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const LeaderboardAll = lazy(() => import("./pages/LeaderboardAll"));
const Congratulations = lazy(() => import("./pages/Congratulations"));
const Admin = lazy(() => import("./pages/Admin"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const Achievements = lazy(() => import("./pages/Achievements"));
const MasterView = lazy(() => import("./pages/MasterView"));
const SpectateView = lazy(() => import("./pages/SpectateView"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,        // 10s before refetching
      gcTime: 5 * 60_000,       // 5 min cache
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,
    },
  },
});

// Premium dark gaming page loader
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center"
    style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,40,217,0.25) 0%,transparent 60%), hsl(224,20%,5%)" }}>
    <div className="flex flex-col items-center gap-6">
      {/* Animated logo */}
      <div className="relative">
        <div className="absolute inset-0 bg-purple-500 rounded-2xl blur-2xl opacity-40 animate-pulse" />
        <div className="relative w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl">
          <span className="text-4xl">⚔️</span>
        </div>
      </div>
      {/* Spinner ring */}
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-purple-900/50" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-400 animate-spin" />
        <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.7s" }} />
      </div>
      <div className="text-center space-y-1">
        <p className="text-purple-300 font-bold tracking-widest text-sm uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          CODE BINGO
        </p>
        <p className="text-slate-500 text-xs font-mono animate-pulse">Initializing arena...</p>
      </div>
      {/* Loading bar */}
      <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-purple-500 rounded-full"
          style={{ backgroundSize: "200% 100%", animation: "shimmer 1.5s linear infinite" }} />
      </div>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner richColors position="top-right" />
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/game" element={<GameRouter />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/leaderboard-all" element={<LeaderboardAll />} />
              <Route path="/congratulations" element={<Congratulations />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/superadmin" element={<SuperAdmin />} />
              <Route path="/master-view" element={<MasterView />} />
              <Route path="/spectate" element={<SpectateView />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
