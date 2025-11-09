import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AchievementManager } from "../achievements";
import { AchievementGrid } from "../components/AchievementComponents";
import { ThemeToggle } from "../components/ThemeProvider";

function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    if (raw === "undefined" || raw === "null") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function useTeam(): any {
  return safeParse<any>(localStorage.getItem("bingo.team"));
}

export default function AchievementsPage() {
  const navigate = useNavigate();
  const team = useTeam();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [achievementManager] = useState(() => AchievementManager.getInstance());

  useEffect(() => {
    if (!team) navigate("/");
  }, [team, navigate]);

  useEffect(() => {
    setAchievements(achievementManager.getAchievements());

    const onUpdated = () => setAchievements(achievementManager.getAchievements());
    window.addEventListener("bingo.achievements.updated", onUpdated as EventListener);
    return () => window.removeEventListener("bingo.achievements.updated", onUpdated as EventListener);
  }, [achievementManager]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="container py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-foreground">Achievements</h1>
            <p className="text-sm text-muted-foreground">
              Team: {team?.team_name} · {unlockedCount}/{totalCount} unlocked (
              {completionPercentage}%)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => navigate("/game")}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Back to Game
            </button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="max-w-4xl mx-auto">
          {/* Progress Overview */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-xl font-bold text-card-foreground mb-4">
              Achievement Progress
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Overall Progress
                </span>
                <span className="text-sm font-semibold text-primary">
                  {completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary">
                    {unlockedCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Unlocked</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {totalCount - unlockedCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-yellow-500">
                    {
                      achievements.filter(
                        (a) => a.rarity === "legendary" && a.unlocked,
                      ).length
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Legendary</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-500">
                    {
                      achievements.filter(
                        (a) => a.rarity === "epic" && a.unlocked,
                      ).length
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Epic</div>
                </div>
              </div>
            </div>
          </div>

          {/* Achievement Categories */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-card-foreground mb-3 flex items-center gap-2">
                🏆 Unlocked Achievements
              </h3>
              <AchievementGrid
                achievements={achievements.filter((a) => a.unlocked)}
                showLocked={false}
              />
            </div>

            {achievements.some((a) => !a.unlocked) && (
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  🔒 Locked Achievements
                </h3>
                <AchievementGrid
                  achievements={achievements.filter((a) => !a.unlocked)}
                  showLocked={true}
                />
              </div>
            )}
          </div>

          {/* Achievement Tips */}
          <div className="bg-card border border-border rounded-xl p-6 mt-6 shadow-sm">
            <h3 className="text-lg font-semibold text-card-foreground mb-3">
              💡 Achievement Tips
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <h4 className="font-medium text-card-foreground mb-2">
                  Speed Achievements
                </h4>
                <ul className="space-y-1 text-xs">
                  <li>• Complete games quickly for "Speed Demon"</li>
                  <li>• Join games early for "Early Bird"</li>
                  <li>• Maintain answer streaks for "Streak Master"</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-card-foreground mb-2">
                  Completion Achievements
                </h4>
                <ul className="space-y-1 text-xs">
                  <li>• Fill entire bingo cards for "Perfectionist"</li>
                  <li>• Answer many questions correctly</li>
                  <li>• Win multiple games for "Legend"</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
