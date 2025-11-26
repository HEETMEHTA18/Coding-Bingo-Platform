import { cn } from "@/lib/utils";

interface GameTimerProps {
    time: string | number;
    type?: "countdown" | "elapsed";
    variant?: "default" | "warning" | "critical";
    className?: string;
}

export default function GameTimer({
    time,
    type = "countdown",
    variant = "default",
    className
}: GameTimerProps) {
    // Format numeric time (seconds) to MM:SS if needed
    const displayTime = typeof time === "number"
        ? `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`
        : time;

    const getVariantStyles = () => {
        switch (variant) {
            case "critical":
                return "from-red-500 to-rose-600 shadow-red-500/30 border-red-400";
            case "warning":
                return "from-amber-500 to-orange-600 shadow-amber-500/30 border-amber-400";
            default:
                return "from-indigo-500 to-purple-600 shadow-indigo-500/30 border-indigo-400";
        }
    };

    return (
        <div className={cn(
            "relative group flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-white shadow-lg border-t border-white/20 bg-gradient-to-br transition-all duration-300 hover:scale-105 hover:shadow-xl",
            getVariantStyles(),
            className
        )}>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-xl bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Icon */}
            <span className="relative z-10 text-lg drop-shadow-md">
                {type === "countdown" ? "⏳" : "⏱️"}
            </span>

            {/* Time */}
            <span className="relative z-10 text-lg tracking-wider drop-shadow-md">
                {displayTime}
            </span>
        </div>
    );
}
