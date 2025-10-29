import { useEffect } from "react";

interface BingoWinnerModalProps {
  show: boolean;
  onContinue: () => void;
}

export function BingoWinnerModal({ show, onContinue }: BingoWinnerModalProps) {
  useEffect(() => {
    if (!show) return;

    // Play celebration sound if available
    const audio = new Audio("/celebration.mp3");
    audio.play().catch(() => {
      // Ignore if audio file doesn't exist
    });
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative max-w-md w-full mx-4 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-2xl shadow-2xl border-4 border-yellow-300 overflow-hidden">
        {/* Animated background sparkles */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 left-10 w-4 h-4 bg-white rounded-full animate-ping"></div>
          <div className="absolute top-20 right-20 w-3 h-3 bg-white rounded-full animate-ping delay-75"></div>
          <div className="absolute bottom-10 left-20 w-2 h-2 bg-white rounded-full animate-ping delay-150"></div>
          <div className="absolute bottom-20 right-10 w-3 h-3 bg-white rounded-full animate-ping delay-100"></div>
        </div>

        {/* Content */}
        <div className="relative p-8 text-center">
          {/* Trophy Icon */}
          <div className="mb-6 animate-bounce">
            <div className="text-8xl mb-4">🏆</div>
          </div>

          {/* BINGO Text */}
          <div className="mb-6">
            <h1 className="text-6xl font-black text-white mb-2 drop-shadow-lg tracking-wider">
              BINGO!
            </h1>
            <div className="flex justify-center gap-2 mb-4">
              <div className="w-12 h-1 bg-white rounded-full"></div>
              <div className="w-12 h-1 bg-white rounded-full"></div>
              <div className="w-12 h-1 bg-white rounded-full"></div>
            </div>
            <p className="text-2xl font-bold text-white drop-shadow-md">
              YOU ARE THE WINNER! 🎉
            </p>
          </div>

          {/* Completed Lines */}
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-6 border-2 border-white/30">
            <p className="text-lg font-semibold text-white mb-2">
              🎯 Full BINGO Completed!
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((line) => (
                <div
                  key={line}
                  className="w-8 h-8 bg-green-500 rounded-lg border-2 border-white flex items-center justify-center font-bold text-white shadow-lg text-sm"
                >
                  ✓
                </div>
              ))}
            </div>
          </div>

          {/* Congratulations Message */}
          <div className="mb-6">
            <p className="text-lg text-white/90 font-medium">
              Congratulations! You've mastered all the coding challenges! 🚀
            </p>
          </div>

          {/* Continue Button */}
          <button
            onClick={onContinue}
            className="w-full px-8 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-yellow-50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform"
          >
            Continue Playing →
          </button>

          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-20 h-20 bg-yellow-300 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-400 rounded-full blur-3xl opacity-50"></div>
        </div>

        {/* Confetti overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 text-4xl animate-spin-slow">
            ✨
          </div>
          <div className="absolute top-1/3 right-1/4 text-3xl animate-spin-slow delay-100">
            ⭐
          </div>
          <div className="absolute bottom-1/4 left-1/3 text-3xl animate-spin-slow delay-200">
            🎊
          </div>
          <div className="absolute bottom-1/3 right-1/3 text-4xl animate-spin-slow delay-75">
            🎉
          </div>
        </div>
      </div>
    </div>
  );
}
