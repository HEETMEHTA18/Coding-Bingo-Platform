import { Achievement } from "../achievements";
import { useEffect } from "react";

interface AchievementBadgeProps {
  achievement: Achievement;
  showProgress?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AchievementBadge({
  achievement,
  showProgress = true,
  size = "md",
}: AchievementBadgeProps) {
  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-lg",
    lg: "w-16 h-16 text-xl",
  };

  const rarityColors = {
    common: "border-gray-300 bg-gray-50 text-gray-700",
    rare: "border-blue-300 bg-blue-50 text-blue-700",
    epic: "border-purple-300 bg-purple-50 text-purple-700",
    legendary: "border-yellow-300 bg-yellow-50 text-yellow-700",
  };

  const progressPercent =
    (achievement.progress / achievement.maxProgress) * 100;

  return (
    <div className="relative group">
      <div
        className={`
          ${sizeClasses[size]}
          ${rarityColors[achievement.rarity]}
          border-2 rounded-full flex items-center justify-center
          transition-all duration-300 hover:scale-110 hover:shadow-lg
          ${achievement.unlocked ? "shadow-md" : "opacity-60 grayscale"}
        `}
      >
        <span className="select-none">{achievement.icon}</span>
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
        <div className="font-semibold">{achievement.title}</div>
        <div className="text-xs text-gray-300">{achievement.description}</div>
        {showProgress && achievement.maxProgress > 1 && (
          <div className="text-xs text-gray-400 mt-1">
            {achievement.progress}/{achievement.maxProgress}
          </div>
        )}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>

      {/* Progress indicator for incomplete achievements */}
      {showProgress && !achievement.unlocked && achievement.maxProgress > 1 && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
          <div
            className="w-3 h-3 bg-primary rounded-full transition-all duration-300"
            style={{
              transform: `scale(${Math.min(progressPercent / 100, 1)})`,
              opacity: progressPercent > 0 ? 1 : 0,
            }}
          ></div>
        </div>
      )}

      {/* Glow effect for unlocked achievements */}
      {achievement.unlocked && (
        <div
          className="absolute inset-0 rounded-full animate-pulse opacity-20"
          style={{
            background:
              achievement.rarity === "legendary"
                ? "radial-gradient(circle, #fbbf24 0%, transparent 70%)"
                : achievement.rarity === "epic"
                  ? "radial-gradient(circle, #a855f7 0%, transparent 70%)"
                  : achievement.rarity === "rare"
                    ? "radial-gradient(circle, #3b82f6 0%, transparent 70%)"
                    : "radial-gradient(circle, #6b7280 0%, transparent 70%)",
          }}
        ></div>
      )}
    </div>
  );
}

interface AchievementGridProps {
  achievements: Achievement[];
  showLocked?: boolean;
}

export function AchievementGrid({
  achievements,
  showLocked = true,
}: AchievementGridProps) {
  const filteredAchievements = showLocked
    ? achievements
    : achievements.filter((a) => a.unlocked);

  return (
    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 p-4">
      {filteredAchievements.map((achievement) => (
        <AchievementBadge
          key={achievement.id}
          achievement={achievement}
          size="md"
        />
      ))}
    </div>
  );
}

interface AchievementNotificationProps {
  achievement: Achievement;
  onClose: () => void;
}

export function AchievementNotification({
  achievement,
  onClose,
}: AchievementNotificationProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const rarityColors = {
    common:
      "border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
    rare: "border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-950",
    epic: "border-purple-400 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-950",
    legendary:
      "border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-950",
  };

  const rarityTextColors = {
    common: "text-gray-700 dark:text-gray-200",
    rare: "text-blue-700 dark:text-blue-200",
    epic: "text-purple-700 dark:text-purple-200",
    legendary: "text-yellow-700 dark:text-yellow-200",
  };

  const rarityBadgeColors = {
    common: "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    rare: "bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-200",
    epic: "bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-200",
    legendary:
      "bg-yellow-200 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-200",
  };

  return (
    <div className="animate-in slide-in-from-right-5 duration-500 max-w-sm w-full">
      <div
        className={`
        ${rarityColors[achievement.rarity]}
        border-2 rounded-xl shadow-2xl p-4 backdrop-blur-sm
        transform transition-all hover:scale-105
      `}
      >
        {/* Header with icon and close button */}
        <div className="flex items-start gap-3 mb-2">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-2xl shadow-lg border-2 border-current animate-bounce">
              {achievement.icon}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4
                className={`text-base font-bold ${rarityTextColors[achievement.rarity]} truncate`}
              >
                🎉 Achievement Unlocked!
              </h4>
              <button
                onClick={onClose}
                className="flex-shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-lg font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/50 dark:hover:bg-black/20"
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
            <p
              className={`text-sm font-semibold ${rarityTextColors[achievement.rarity]} mt-1`}
            >
              {achievement.title}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              {achievement.description}
            </p>
          </div>
        </div>

        {/* Rarity badge */}
        <div className="flex justify-between items-center mt-3">
          <span
            className={`
            ${rarityBadgeColors[achievement.rarity]}
            text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide
            shadow-sm
          `}
          >
            {achievement.rarity}
          </span>

          {/* Progress indicator (if maxProgress > 1) */}
          {achievement.maxProgress > 1 && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {achievement.progress}/{achievement.maxProgress}
            </span>
          )}
        </div>

        {/* Sparkle effect */}
        <div className="absolute -top-1 -right-1 text-yellow-400 animate-pulse text-xl">
          ✨
        </div>
        <div
          className="absolute -bottom-1 -left-1 text-yellow-400 animate-pulse text-xl"
          style={{ animationDelay: "0.5s" }}
        >
          ✨
        </div>
      </div>
    </div>
  );
}
