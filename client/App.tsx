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

const queryClient = new QueryClient();

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-600 dark:text-slate-400 font-medium animate-pulse">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
