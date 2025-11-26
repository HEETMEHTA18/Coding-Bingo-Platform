// Code Memory Match Game
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import GameHeader from "../../components/GameHeader";
import type { Team, Room, GameStateResponse } from "@shared/api";

function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    if (raw === "undefined" || raw === "null") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type Question = {
  id: string;
  question_id: number;
  question_text: string;
  is_real: boolean;
};

type CardItem = {
  id: number;
  content: string;
  type: 'code' | 'concept';
  isFlipped: boolean;
  isMatched: boolean;
};

type PowerUp = {
  type: "peek" | "time";
  name: string;
  isUnlocked: boolean;
};

export default function MemoryGame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  // Game state
  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [moves, setMoves] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Questions system
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [solvedQuestions, setSolvedQuestions] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Power-ups
  const [powerUps, setPowerUps] = useState<PowerUp[]>([
    { type: "peek", name: "Peek All", isUnlocked: false },
    { type: "time", name: "Extra Time", isUnlocked: false }, // Placeholder for now
  ]);

  useEffect(() => {
    if (!team || !room) {
      navigate("/");
      return;
    }
    initializeGame();
    loadQuestions();
  }, [team, room, navigate]);

  const initializeGame = () => {
    const pairs = [
      { code: "[]", concept: "Array" },
      { code: "{}", concept: "Object" },
      { code: "() => {}", concept: "Arrow Function" },
      { code: "useState", concept: "Hook" },
      { code: "< />", concept: "JSX" },
      { code: "async", concept: "Promise" },
      { code: "npm", concept: "Package Manager" },
      { code: "git", concept: "Version Control" },
    ];

    const gameCards: CardItem[] = [];
    pairs.forEach((pair, index) => {
      gameCards.push({
        id: index * 2,
        content: pair.code,
        type: 'code',
        isFlipped: false,
        isMatched: false,
      });
      gameCards.push({
        id: index * 2 + 1,
        content: pair.concept,
        type: 'concept',
        isFlipped: false,
        isMatched: false,
      });
    });

    setCards(shuffle(gameCards));
    setFlippedCards([]);
    setMatchedPairs(0);
    setMoves(0);
  };

  const shuffle = (array: any[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const loadQuestions = async () => {
    try {
      const teamId = team?.team_id || team?.id;
      const res = await fetch(`/api/game?room=${encodeURIComponent(room?.code || "")}&team=${encodeURIComponent(teamId || "")}`);
      if (!res.ok) return;

      const data = await res.json() as GameStateResponse;
      if (data.questions && data.questions.length > 0) {
        const mappedQuestions: Question[] = data.questions.map(q => ({
          id: q.id,
          question_id: q.question_id || 0,
          question_text: q.question_text || q.text,
          is_real: q.is_real ?? true,
        }));
        setQuestions(mappedQuestions);
      }
    } catch (error) {
      console.error("Error loading questions:", error);
    }
  };

  const handleCardClick = (id: number) => {
    if (isProcessing) return;

    const clickedCard = cards.find(c => c.id === id);
    if (!clickedCard || clickedCard.isMatched || clickedCard.isFlipped) return;

    const newCards = cards.map(c => c.id === id ? { ...c, isFlipped: true } : c);
    setCards(newCards);

    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setIsProcessing(true);
      setMoves(prev => prev + 1);
      checkForMatch(newFlipped, newCards);
    }
  };

  const checkForMatch = (flippedIds: number[], currentCards: CardItem[]) => {
    const [id1, id2] = flippedIds;
    const card1 = currentCards.find(c => c.id === id1);
    const card2 = currentCards.find(c => c.id === id2);

    if (!card1 || !card2) return;

    // Check if they are a pair (based on ID logic: pair IDs are N and N+1 where N is even)
    // Actually, my ID logic was index * 2 and index * 2 + 1. So Math.floor(id/2) should be equal.
    const isMatch = Math.floor(card1.id / 2) === Math.floor(card2.id / 2);

    if (isMatch) {
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          c.id === id1 || c.id === id2 ? { ...c, isMatched: true } : c
        ));
        setFlippedCards([]);
        setIsProcessing(false);
        setMatchedPairs(prev => prev + 1);
        toast({
          title: "✨ Match Found!",
          className: "bg-green-50 border-green-200 text-green-800"
        });
      }, 500);
    } else {
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          c.id === id1 || c.id === id2 ? { ...c, isFlipped: false } : c
        ));
        setFlippedCards([]);
        setIsProcessing(false);
      }, 1000);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      toast({ title: "Please enter an answer", variant: "default" });
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setSubmitting(true);
    try {
      const teamId = team?.team_id || team?.id;
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: room?.code,
          teamId: String(teamId),
          questionId: String(currentQuestion.id),
          answer: answer,
        }),
      });

      if (!res.ok) throw new Error("Submit failed");

      const result = await res.json();

      if (result.correct) {
        setSolvedQuestions(prev => [...prev, currentQuestionIndex]);

        // Unlock power-up
        const nextUnlocked = powerUps.findIndex(p => !p.isUnlocked);
        if (nextUnlocked !== -1) {
          const newPowerUps = [...powerUps];
          newPowerUps[nextUnlocked] = { ...newPowerUps[nextUnlocked], isUnlocked: true };
          setPowerUps(newPowerUps);
          toast({
            title: "✅ Correct!",
            description: `Power-up "${newPowerUps[nextUnlocked].name}" unlocked!`,
          });
        }

        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setAnswer("");
        }
      } else {
        toast({ title: "❌ Incorrect", description: "Try again!", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Failed to submit answer", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePeek = () => {
    const peekPowerUp = powerUps.find(p => p.type === "peek" && p.isUnlocked);
    if (!peekPowerUp) {
      toast({ title: "🔒 Locked", description: "Answer questions to unlock!", variant: "default" });
      return;
    }

    setIsProcessing(true);
    const originalState = cards.map(c => ({ ...c }));

    // Flip all unmatched cards
    setCards(prev => prev.map(c => !c.isMatched ? { ...c, isFlipped: true } : c));

    toast({ title: "👀 Peeking...", description: "Memorize quickly!" });

    setTimeout(() => {
      setCards(originalState); // Restore original state (flipped status)
      // Actually, we need to be careful not to revert matched cards if they were matched during peek (impossible)
      // But we should revert to 'isFlipped: false' for unmatched cards.
      setCards(prev => prev.map(c => !c.isMatched ? { ...c, isFlipped: false } : c));
      setIsProcessing(false);
    }, 2000);
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 dark:from-slate-950 dark:via-violet-950/30 dark:to-fuchsia-950/30">
      <GameHeader
        gameTitle="Memory Match"
        gameIcon="🧠"
        team={team}
        room={room}
        extraInfo={
          <Badge variant="outline" className="text-sm py-1 border-violet-200 text-violet-700 dark:border-violet-800 dark:text-violet-300">
            Moves: {moves}
          </Badge>
        }
      />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Questions & Power-ups */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xl">
                  ❓
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quiz Challenge</h2>
              </div>

              {currentQuestion ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary" className="bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
                        Q{currentQuestionIndex + 1}
                      </Badge>
                      <Badge variant="outline" className="text-green-600 border-green-200 dark:text-green-400 dark:border-green-800">
                        {solvedQuestions.length} Solved
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{currentQuestion.question_text}</p>
                    <div className="space-y-2">
                      <Input
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
                        placeholder="Answer..."
                        className="bg-white dark:bg-slate-950"
                      />
                      <Button
                        onClick={handleSubmitAnswer}
                        disabled={submitting}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-slate-500">All questions solved!</div>
              )}
            </Card>

            <Card className="p-6 bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span>⚡</span> Power-Ups
              </h3>
              <Button
                onClick={handlePeek}
                disabled={!powerUps.find(p => p.type === "peek")?.isUnlocked || isProcessing}
                className={`w-full ${powerUps.find(p => p.type === "peek")?.isUnlocked
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                  }`}
              >
                👀 Peek All (2s)
              </Button>
            </Card>
          </div>

          {/* Right Column: Game Grid */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-white dark:bg-slate-900 shadow-2xl border-slate-200 dark:border-slate-800 min-h-[500px] flex flex-col items-center justify-center">
              {matchedPairs === cards.length / 2 && cards.length > 0 ? (
                <div className="text-center animate-in zoom-in duration-500">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Memory Master!</h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">You completed the game in {moves} moves.</p>
                  <Button
                    onClick={initializeGame}
                    size="lg"
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-8"
                  >
                    Play Again
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3 sm:gap-4 w-full max-w-2xl mx-auto perspective-1000">
                  {cards.map(card => (
                    <div
                      key={card.id}
                      onClick={() => handleCardClick(card.id)}
                      className={`aspect-[3/4] relative cursor-pointer transition-all duration-500 transform-style-3d ${card.isFlipped || card.isMatched ? "rotate-y-180" : ""
                        }`}
                    >
                      {/* Front (Back of card) */}
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center backface-hidden border-2 border-white/20">
                        <span className="text-3xl opacity-50">🧠</span>
                      </div>

                      {/* Back (Content) */}
                      <div className={`absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xl flex items-center justify-center p-2 text-center backface-hidden rotate-y-180 border-2 ${card.isMatched ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-violet-200 dark:border-violet-700"
                        }`}>
                        <span className={`font-bold ${card.type === 'code'
                            ? "font-mono text-sm sm:text-base text-pink-600 dark:text-pink-400"
                            : "text-xs sm:text-sm text-slate-700 dark:text-slate-300"
                          }`}>
                          {card.content}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
