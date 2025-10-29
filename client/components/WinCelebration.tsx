import { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  velocity: { x: number; y: number };
  rotationSpeed: number;
}

interface ConfettiCelebrationProps {
  isActive: boolean;
  duration?: number;
  particleCount?: number;
  onComplete?: () => void;
}

const COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#f9ca24",
  "#f0932b",
  "#eb4d4b",
  "#6c5ce7",
  "#a29bfe",
  "#fd79a8",
  "#e17055",
];

export function ConfettiCelebration({
  isActive,
  duration = 3000,
  particleCount = 100,
  onComplete,
}: ConfettiCelebrationProps) {
  const [particles, setParticles] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!isActive) {
      setParticles([]);
      return;
    }

    // Create particles
    const newParticles: ConfettiPiece[] = [];
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -10,
        rotation: Math.random() * 360,
        scale: Math.random() * 0.8 + 0.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        velocity: {
          x: (Math.random() - 0.5) * 8,
          y: Math.random() * 3 + 2,
        },
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    setParticles(newParticles);

    // Animation loop
    let animationId: number;
    let startTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;

      if (elapsed >= duration) {
        setParticles([]);
        onComplete?.();
        return;
      }

      setParticles((prevParticles) =>
        prevParticles
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.velocity.x,
            y: particle.y + particle.velocity.y,
            rotation: particle.rotation + particle.rotationSpeed,
            velocity: {
              ...particle.velocity,
              y: particle.velocity.y + 0.1, // gravity
            },
          }))
          .filter((particle) => particle.y < window.innerHeight + 50),
      );

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, duration, particleCount, onComplete]);

  if (!isActive || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-3 h-3"
          style={{
            left: particle.x,
            top: particle.y,
            transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
            backgroundColor: particle.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "0",
            boxShadow: `0 0 6px ${particle.color}40`,
          }}
        />
      ))}
    </div>
  );
}

interface WinCelebrationProps {
  show: boolean;
  linesCompleted: number;
  onComplete?: () => void;
}

export function WinCelebration({
  show,
  linesCompleted,
  onComplete,
}: WinCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (!show) {
      setShowConfetti(false);
      setShowMessage(false);
      return;
    }

    // Start confetti immediately
    setShowConfetti(true);

    // Show message after a short delay
    const messageTimer = setTimeout(() => {
      setShowMessage(true);
    }, 500);

    // Stop confetti after duration
    const confettiTimer = setTimeout(() => {
      setShowConfetti(false);
    }, 4000);

    // Complete celebration
    const completeTimer = setTimeout(() => {
      setShowMessage(false);
      onComplete?.();
    }, 5000);

    return () => {
      clearTimeout(messageTimer);
      clearTimeout(confettiTimer);
      clearTimeout(completeTimer);
    };
  }, [show, onComplete]);

  if (!show) return null;

  const getCelebrationMessage = () => {
    if (linesCompleted >= 5) return "🎉 PERFECT BINGO! 🎉";
    if (linesCompleted >= 3) return "🏆 AMAZING WIN! 🏆";
    if (linesCompleted >= 1) return "🎊 BINGO! 🎊";
    return "🎉 Great Job! 🎉";
  };

  const getCelebrationColor = () => {
    if (linesCompleted >= 5) return "text-yellow-500";
    if (linesCompleted >= 3) return "text-purple-500";
    return "text-green-500";
  };

  return (
    <>
      <ConfettiCelebration
        isActive={showConfetti}
        duration={3500}
        particleCount={
          linesCompleted >= 5 ? 150 : linesCompleted >= 3 ? 120 : 80
        }
      />

      {showMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div
            className={`text-center animate-bounce ${getCelebrationColor()}`}
          >
            <div className="text-6xl md:text-8xl font-bold drop-shadow-lg">
              {getCelebrationMessage()}
            </div>
            <div className="text-xl md:text-2xl mt-4 text-gray-700 dark:text-gray-300">
              {linesCompleted} line{linesCompleted !== 1 ? "s" : ""} completed!
            </div>
          </div>
        </div>
      )}
    </>
  );
}
