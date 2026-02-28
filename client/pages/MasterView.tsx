import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sword, Trophy, Users, Monitor, Shield, X, Circle } from "lucide-react";

export default function MasterView() {
  const [data, setData] = useState<any[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await fetch("/api/master/state");
      if (res.ok) {
        const d = await res.json();
        setData(d.rooms || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#050510] text-white p-8 font-sans">
      <header className="flex justify-between items-center mb-12 border-b border-white/10 pb-6">
        <div className="flex gap-4 items-center">
          <div className="p-3 bg-purple-600 rounded-2xl shadow-[0_0_30px_rgba(147,51,234,0.3)]">
            <Monitor className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter">HACKATHON COMMAND MASTER VIEW</h1>
            <p className="text-slate-500 uppercase tracking-widest text-xs font-bold">Monitoring {data.length} Live Operations</p>
          </div>
        </div>
        <Button onClick={() => navigate("/admin")} variant="outline" className="border-slate-800 text-slate-400">
          DASHBOARD
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {data.map((item, idx) => (
          <Card key={idx} className="bg-[#0f0f1a] border-slate-800 overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-600 opacity-50 group-hover:bg-blue-500 transition-colors" />

            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{item.room.code}</h2>
                  <p className="text-slate-500 text-sm font-mono">{item.room.title}</p>
                </div>
                <Badge className="bg-purple-900/40 text-purple-400 border-purple-500/30">
                  {item.room.gameType.toUpperCase()}
                </Badge>
              </div>

              {item.room.gameType === 'tictactoe' && item.board ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="grid grid-cols-3 gap-2 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    {item.board.cells.map((cell: any, i: number) => (
                      <div key={i} className="w-16 h-16 bg-[#050510] rounded-lg border border-slate-800 flex items-center justify-center text-2xl font-black shadow-inner">
                        {cell === 'X' && <X className="text-blue-500" />}
                        {cell === 'O' && <Circle className="text-red-500" />}
                      </div>
                    ))}
                  </div>

                  <div className="w-full space-y-3">
                    {item.teams.map((t: any, ti: number) => (
                      <div key={ti} className="flex justify-between items-center p-3 bg-black/40 rounded-lg border border-slate-800/50">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.board.teamX === t.teamId ? 'bg-blue-500' : item.board.teamO === t.teamId ? 'bg-red-500' : 'bg-slate-500'}`} />
                          <span className="font-bold text-sm truncate max-w-[120px]">{t.teamName}</span>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[10px] border-slate-700">SCR: {t.linesCompleted}</Badge>
                          <Badge variant="outline" className="text-[10px] border-slate-700 text-blue-400">MV: {item.board.movesCredits?.[t.teamId] || 0}</Badge>
                          <Badge variant="outline" className="text-[10px] border-slate-700 text-red-400">KN: {item.board.knivesCredits?.[t.teamId] || 0}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {item.board.winner && (
                    <div className="mt-2 text-yellow-500 font-black animate-pulse flex items-center gap-2">
                      <Trophy size={16} /> WINNER: {item.board.winner}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-40 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed flex items-center justify-center">
                    <Users className="text-slate-700 w-12 h-12" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Units</h4>
                    {item.teams.slice(0, 3).map((t: any, ti: number) => (
                      <div key={ti} className="flex justify-between items-center text-sm p-2 bg-black/20 rounded border border-slate-800/20">
                        <span>{t.teamName}</span>
                        <span className="font-mono text-purple-400">{t.linesCompleted} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900/50 p-3 flex justify-between items-center text-[10px] font-bold tracking-tighter text-slate-500">
              <span>SYSTEM STATUS: STABLE</span>
              <span>DATA REFRESH: LIVE</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
