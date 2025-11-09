// Achievement system for the Bingo Platform
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedAt?: Date;
}

export interface AchievementProgress {
  [key: string]: {
    progress: number;
    unlocked: boolean;
    unlockedAt?: Date;
  };
}

// Achievement definitions
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_blood",
    title: "First Blood",
    description: "Answer your first question correctly",
    icon: "�",
    rarity: "common",
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: "first_line",
    title: "Line Starter",
    description: "Complete your first bingo line",
    icon: "📏",
    rarity: "common",
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: "streak_5",
    title: "Hot Streak",
    description: "Get 5 correct answers in a row",
    icon: "🔥",
    rarity: "rare",
    unlocked: false,
    progress: 0,
    maxProgress: 5,
  },
  {
    id: "streak_10",
    title: "On Fire!",
    description: "Get 10 correct answers in a row",
    icon: "�🔥",
    rarity: "epic",
    unlocked: false,
    progress: 0,
    maxProgress: 10,
  },
  {
    id: "streak_15",
    title: "Unstoppable",
    description: "Get 15 correct answers in a row",
    icon: "🔥🔥🔥",
    rarity: "legendary",
    unlocked: false,
    progress: 0,
    maxProgress: 15,
  },
  {
    id: "perfectionist",
    title: "BINGO Master",
    description: "Complete all 5 lines (Full BINGO)",
    icon: "�",
    rarity: "epic",
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: "speed_demon",
    title: "Speed Demon",
    description: "Answer 3 questions correctly within 2 minutes",
    icon: "⚡",
    rarity: "rare",
    unlocked: false,
    progress: 0,
    maxProgress: 3,
  },
  {
    id: "sharp_mind",
    title: "Sharp Mind",
    description: "Answer 25 questions correctly in one game",
    icon: "🧠",
    rarity: "epic",
    unlocked: false,
    progress: 0,
    maxProgress: 25,
  },
  {
    id: "triple_threat",
    title: "Triple Threat",
    description: "Complete 3 lines in a single game",
    icon: "⭐",
    rarity: "rare",
    unlocked: false,
    progress: 0,
    maxProgress: 3,
  },
  {
    id: "no_mistakes",
    title: "Flawless Victory",
    description: "Win a game without any wrong answers",
    icon: "✨",
    rarity: "legendary",
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
];

export class AchievementManager {
  private static instance: AchievementManager;
  private progress: AchievementProgress = {};

  private constructor() {
    this.loadProgress();
  }

  static getInstance(): AchievementManager {
    if (!AchievementManager.instance) {
      AchievementManager.instance = new AchievementManager();
    }
    return AchievementManager.instance;
  }

  private loadProgress(): void {
    const stored = localStorage.getItem("bingo.achievements");
    if (stored) {
      this.progress = JSON.parse(stored);
    }
  }

  private saveProgress(): void {
    localStorage.setItem("bingo.achievements", JSON.stringify(this.progress));
    // emit a global event so UI pages can update reactively
    try {
      window.dispatchEvent(new CustomEvent("bingo.achievements.updated"));
    } catch {
      // ignore if environment doesn't support window
    }
  }

  getAchievements(): Achievement[] {
    return ACHIEVEMENTS.map((achievement) => ({
      ...achievement,
      ...this.progress[achievement.id],
      unlocked: this.progress[achievement.id]?.unlocked || false,
      progress: this.progress[achievement.id]?.progress || 0,
    }));
  }

  updateProgress(achievementId: string, increment: number = 1): Achievement[] {
    const current = this.progress[achievementId] || {
      progress: 0,
      unlocked: false,
    };
    const newProgress = Math.min(
      current.progress + increment,
      ACHIEVEMENTS.find((a) => a.id === achievementId)?.maxProgress || 0,
    );

    const wasUnlocked = current.unlocked;
    const nowUnlocked =
      newProgress >=
      (ACHIEVEMENTS.find((a) => a.id === achievementId)?.maxProgress || 0);

    this.progress[achievementId] = {
      progress: newProgress,
      unlocked: nowUnlocked,
      unlockedAt: nowUnlocked && !wasUnlocked ? new Date() : current.unlockedAt,
    };

    this.saveProgress();

    // Return newly unlocked achievements
    if (nowUnlocked && !wasUnlocked) {
      return [ACHIEVEMENTS.find((a) => a.id === achievementId)!];
    }

    return [];
  }

  // Specific achievement triggers
  onGameWin(linesCompleted: number): Achievement[] {
    const newAchievements: Achievement[] = [];

    // First line completed
    if (linesCompleted >= 1) {
      newAchievements.push(...this.updateProgress("first_line"));
    }

    // Triple threat - 3 lines
    if (linesCompleted >= 3) {
      newAchievements.push(...this.updateProgress("triple_threat", 3));
    }

    // Full BINGO - all 5 lines
    if (linesCompleted >= 5) {
      newAchievements.push(...this.updateProgress("perfectionist"));
    }

    return newAchievements;
  }

  onCorrectAnswer(): Achievement[] {
    const newAchievements: Achievement[] = [];

    // First correct answer
    newAchievements.push(...this.updateProgress("first_blood"));

    // Track for sharp mind (25 correct in one game)
    newAchievements.push(...this.updateProgress("sharp_mind"));

    // Update streak achievements
    const currentStreak = (this.progress["current_streak"]?.progress || 0) + 1;

    // Store current streak (not a real achievement, just tracking)
    this.progress["current_streak"] = {
      progress: currentStreak,
      unlocked: false,
    };

    // Check streak milestones
    if (currentStreak >= 5) {
      newAchievements.push(...this.updateProgress("streak_5", 5));
    }
    if (currentStreak >= 10) {
      newAchievements.push(...this.updateProgress("streak_10", 10));
    }
    if (currentStreak >= 15) {
      newAchievements.push(...this.updateProgress("streak_15", 15));
    }

    // Track for speed demon (3 correct within 2 minutes)
    const now = Date.now();
    const storedAnswers = this.progress["recent_answers_list"];
    let recentAnswers: number[] = Array.isArray(storedAnswers?.progress)
      ? (storedAnswers.progress as number[])
      : [];
    recentAnswers.push(now);

    // Keep only answers from last 2 minutes
    const twoMinutesAgo = now - 2 * 60 * 1000;
    recentAnswers = recentAnswers.filter(
      (time: number) => time > twoMinutesAgo,
    );

    // Store as separate tracking entry (not a real achievement)
    (this.progress as any)["recent_answers_list"] = {
      progress: recentAnswers,
      unlocked: false,
    };

    if (recentAnswers.length >= 3) {
      newAchievements.push(...this.updateProgress("speed_demon", 3));
    }

    this.saveProgress();
    return newAchievements;
  }

  onWrongAnswer(): void {
    // Reset streak
    if (this.progress["current_streak"]) {
      this.progress["current_streak"].progress = 0;
      this.saveProgress();
    }

    // Mark that player made a mistake (for flawless victory tracking)
    this.progress["made_mistake"] = {
      progress: 1,
      unlocked: false,
    };
    this.saveProgress();
  }

  onGameStart(): void {
    // Reset game-specific trackers
    this.progress["sharp_mind"] = {
      progress: 0,
      unlocked: this.progress["sharp_mind"]?.unlocked || false,
    };
    this.progress["current_streak"] = { progress: 0, unlocked: false };
    (this.progress as any)["recent_answers_list"] = {
      progress: [],
      unlocked: false,
    };
    this.progress["made_mistake"] = { progress: 0, unlocked: false };
    this.saveProgress();
  }

  onFlawlessWin(): Achievement[] {
    // Check if player won without any mistakes
    if (
      !this.progress["made_mistake"] ||
      this.progress["made_mistake"].progress === 0
    ) {
      return this.updateProgress("no_mistakes");
    }
    return [];
  }

  // Helper to reset all progress (for testing)
  resetAllProgress(): void {
    this.progress = {};
    this.saveProgress();
  }
}
