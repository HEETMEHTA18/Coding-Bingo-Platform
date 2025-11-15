// Code Memory Match Game with Questions & Power-Ups
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
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

type MemoryCard = {
  id: number;
  code: string;
  isFlipped: boolean;
  isMatched: boolean;
};

type PowerUp = {
  type: "peek" | "reveal";
  isUnlocked: boolean;
};

export default function MemoryGame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  // Game state
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);

  // Questions system
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [solvedQuestions, setSolvedQuestions] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Power-ups system
  const [powerUps, setPowerUps] = useState<PowerUp[]>([
    { type: "peek", isUnlocked: false },
    { type: "reveal", isUnlocked: false },
  ]);
  const [peeksUsed, setPeeksUsed] = useState(0);
  const [revealsUsed, setRevealsUsed] = useState(0);

  useEffect(() => {
    if (!team || !room) {
      navigate("/");
      return;
    }
    loadQuestions();
    initializeGame();
  }, [team, room, navigate]);

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

  const initializeGame = () => {
    // Create 6 pairs of code snippets (12 cards total)
    const codeSnippets = [
      "if (x > 5)",
      "for (i = 0)",
      "while (true)",
      "return x",
      "break;",
      "continue;",
    ];
    
    const cardPairs = codeSnippets.flatMap((code, index) => [
      { id: index * 2, code, isFlipped: false, isMatched: false },
      { id: index * 2 + 1, code, isFlipped: false, isMatched: false },
    ]);
    
    // Shuffle cards
    const shuffled = cardPairs.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setMatchedPairs(0);
    setMoves(0);
    setFlippedCards([]);
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
          questionId: String(currentQuestion.question_id),
          answer: answer,
        }),
      });

      if (!res.ok) {
        let errMsg = `Submit failed: ${res.status}`;
        try {
          const body = await res.text();
          try {
            const j = JSON.parse(body);
            if (j && j.error) errMsg = `${errMsg} - ${j.error}`;
          } catch {}
        } catch {}
        throw new Error(errMsg);
      }

      const result = await res.json();
      
      if (result.correct) {
        setSolvedQuestions(prev => [...prev, currentQuestionIndex]);
        
        // Unlock next power-up
        const nextUnlocked = powerUps.findIndex(p => !p.isUnlocked);
        if (nextUnlocked !== -1) {
          const newPowerUps = [...powerUps];
          newPowerUps[nextUnlocked] = { ...newPowerUps[nextUnlocked], isUnlocked: true };
          setPowerUps(newPowerUps);
          toast({ 
            title: "✅ Correct!", 
            description: `Power-up "${newPowerUps[nextUnlocked].type}" unlocked!`,
          });
        } else {
          toast({ title: "✅ Correct!", description: "All power-ups unlocked!" });
        }
        
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setAnswer("");
        }
      } else {
        toast({ title: "❌ Incorrect", description: "Try again!", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      toast({ title: "Failed to submit answer", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardClick = (cardId: number) => {
    if (flippedCards.length >= 2) return;
    if (flippedCards.includes(cardId)) return;
    if (cards[cardId].isMatched) return;

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(prev => prev + 1);
      const [first, second] = newFlipped;
      if (cards[first].code === cards[second].code) {
        // Match found
        const newCards = [...cards];
        newCards[first].isMatched = true;
        newCards[second].isMatched = true;
        setCards(newCards);
        setMatchedPairs(prev => prev + 1);
        setTimeout(() => setFlippedCards([]), 500);
        toast({ title: "✅ Match!", description: "Great job!" });
      } else {
        // No match
        setTimeout(() => setFlippedCards([]), 1000);
      }
    }
  };

  const handleUsePeek = () => {
    const peekPowerUp = powerUps.find(p => p.type === "peek" && p.isUnlocked);
    if (!peekPowerUp) {
      toast({ title: "🔒 Locked", description: "Answer questions to unlock Peek!", variant: "default" });
      return;
    }
    
    // Flip all unmatched cards for 2 seconds
    const newCards = cards.map(c => ({ ...c, isFlipped: !c.isMatched || c.isFlipped }));
    setCards(newCards);
    setPeeksUsed(prev => prev + 1);
    toast({ title: "👀 Peek Used!", description: "All cards revealed for 2 seconds" });
    
    setTimeout(() => {
      setCards(cards.map(c => ({ ...c, isFlipped: c.isMatched })));
    }, 2000);
  };

  const handleUseReveal = () => {
    const revealPowerUp = powerUps.find(p => p.type === "reveal" && p.isUnlocked);
    if (!revealPowerUp) {
      toast({ title: "🔒 Locked", description: "Answer questions to unlock Reveal!", variant: "default" });
      return;
    }

    // Reveal one random unmatched pair
    const unmatchedCards = cards.filter(c => !c.isMatched);
    if (unmatchedCards.length < 2) return;
    
    const randomCode = unmatchedCards[0].code;
    const pairIndexes = cards
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.code === randomCode && !c.isMatched)
      .map(({ i }) => i);
    
    if (pairIndexes.length === 2) {
      const newCards = [...cards];
      newCards[pairIndexes[0]].isMatched = true;
      newCards[pairIndexes[1]].isMatched = true;
      setCards(newCards);
      setMatchedPairs(prev => prev + 1);
      setRevealsUsed(prev => prev + 1);
      toast({ title: "💡 Reveal Used!", description: "A pair has been revealed!" });
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const isComplete = matchedPairs === 6;
  const progress = Math.round((matchedPairs / 6) * 100);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <GameHeader
        gameTitle="Code Memory Match"
        gameIcon="🧠"
        team={team}
        room={room}
        extraInfo={
          <>
            <div className="px-3 sm:px-4 py-2 rounded-lg bg-blue-900/30 border border-blue-700 shadow-md">
              <span className="text-blue-200 font-semibold text-sm sm:text-base">Progress: {progress}%</span>
            </div>
            <div className="px-3 sm:px-4 py-2 rounded-lg bg-purple-900/30 border border-purple-700 shadow-md">
              <span className="text-purple-200 font-semibold text-sm sm:text-base">Moves: {moves}</span>
            </div>
          </>
        }
      />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Questions Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-blue-500/30 shadow-2xl shadow-blue-500/10 p-4 sm:p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-500/20 p-3 rounded-xl">
                  <span className="text-2xl">📝</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Coding Challenge</h2>
              </div>
              
              {currentQuestion ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs sm:text-sm font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">
                        Question {currentQuestionIndex + 1} / {questions.length}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
                        ✅ {solvedQuestions.length}
                      </span>
                    </div>
                    <div className="bg-slate-900/70 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50">
                      <p className="text-white text-sm sm:text-base">{currentQuestion.question_text}</p>
                    </div>
                  </div>
                  
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !submitting && handleSubmitAnswer()}
                    placeholder="Type your answer..."
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-slate-900/70 border-2 border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all text-sm"
                  />
                  
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={submitting}
                    className="w-full mt-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold disabled:opacity-50 transition-all text-sm"
                  >
                    {submitting ? "⏳ Submitting..." : "Submit Answer"}
                  </button>
                </>
              ) : (
                <div className="text-center py-4 text-slate-400">No questions available</div>
              )}
            </div>

            {/* Power-ups Panel */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/10 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-500/20 p-3 rounded-xl">
                  <span className="text-2xl">⚡</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Power-Ups</h2>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={handleUsePeek}
                  disabled={!powerUps.find(p => p.type === "peek")?.isUnlocked}
                  className={`w-full p-4 rounded-xl transition-all ${
                    powerUps.find(p => p.type === "peek")?.isUnlocked
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 cursor-pointer"
                      : "bg-slate-800/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold">👀 Peek (2s)</span>
                    {!powerUps.find(p => p.type === "peek")?.isUnlocked && <span>🔒</span>}
                  </div>
                </button>
                
                <button
                  onClick={handleUseReveal}
                  disabled={!powerUps.find(p => p.type === "reveal")?.isUnlocked}
                  className={`w-full p-4 rounded-xl transition-all ${
                    powerUps.find(p => p.type === "reveal")?.isUnlocked
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 cursor-pointer"
                      : "bg-slate-800/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold">💡 Reveal Pair</span>
                    {!powerUps.find(p => p.type === "reveal")?.isUnlocked && <span>🔒</span>}
                  </div>
                </button>
              </div>
              
              <div className="mt-4 text-xs text-slate-400 text-center">
                Used: Peek {peeksUsed} | Reveal {revealsUsed}
              </div>
            </div>
          </div>

          {/* Memory Grid */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl border-2 border-indigo-500/30 shadow-2xl shadow-indigo-500/10 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-500/20 p-3 rounded-xl">
                  <span className="text-2xl">🧠</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Memory Grid</h2>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
                {cards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => handleCardClick(card.id)}
                    disabled={card.isMatched || flippedCards.includes(card.id)}
                    className={`aspect-square p-4 rounded-xl font-mono text-sm font-bold transition-all transform ${
                      card.isMatched
                        ? "bg-green-600/30 text-green-200 border-2 border-green-500/50 cursor-default"
                        : flippedCards.includes(card.id)
                          ? "bg-blue-600 text-white border-2 border-blue-400 scale-95"
                          : "bg-slate-800/70 text-slate-800 border-2 border-slate-700/50 hover:bg-slate-700 hover:scale-105 cursor-pointer"
                    }`}
                  >
                    {(card.isMatched || flippedCards.includes(card.id)) ? card.code : "?"}
                  </button>
                ))}
              </div>

              {isComplete && (
                <div className="mt-6 p-6 bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-2 border-green-500/50 rounded-xl text-center">
                  <div className="text-4xl mb-2 animate-bounce">🎉</div>
                  <h3 className="text-green-200 font-bold text-xl mb-2">Perfect Match!</h3>
                  <p className="text-green-300 text-sm mb-4">
                    Completed in {moves} moves | Power-ups: {peeksUsed + revealsUsed}
                  </p>
                  <button
                    onClick={() => {
                      initializeGame();
                      setCurrentQuestionIndex(0);
                      setSolvedQuestions([]);
                      setPowerUps([
                        { type: "peek", isUnlocked: false },
                        { type: "reveal", isUnlocked: false },
                      ]);
                      setPeeksUsed(0);
                      setRevealsUsed(0);
                      setAnswer("");
                    }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold"
                  >
                    🎮 New Game
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
