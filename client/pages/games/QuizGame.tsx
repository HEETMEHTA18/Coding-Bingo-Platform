// Code Quiz Game
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Question, Team } from "@shared/api";
import { apiFetch } from "../../lib/api";
import GameHeader from "../../components/GameHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QuizState {
  currentQuestionIndex: number;
  score: number;
  answeredQuestions: Set<number>;
  selectedAnswer: number | null;
  showResult: boolean;
  isCorrect: boolean;
}

export default function QuizGame() {
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestionIndex: 0,
    score: 0,
    answeredQuestions: new Set(),
    selectedAnswer: null,
    showResult: false,
    isCorrect: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawTeam = localStorage.getItem("bingo.team");
    try {
      const t = rawTeam && rawTeam !== "undefined" ? JSON.parse(rawTeam) : null;
      if (!t) {
        navigate("/");
        return;
      }
      setTeam(t);
      loadQuestions(t);
    } catch {
      navigate("/");
    }
  }, [navigate]);

  const loadQuestions = async (t: Team) => {
    try {
      const res = await apiFetch(`/api/game-state?teamId=${t.team_id}`);
      const data = await res.json();
      setQuestions(data.questions || []);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load questions:", err);
      setLoading(false);
    }
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (quizState.showResult) return;
    setQuizState((prev) => ({ ...prev, selectedAnswer: optionIndex }));
  };

  const handleSubmitAnswer = () => {
    const currentQuestion = questions[quizState.currentQuestionIndex];
    const isCorrect = quizState.selectedAnswer === currentQuestion.correctAnswer;

    setQuizState((prev) => ({
      ...prev,
      showResult: true,
      isCorrect,
      score: isCorrect ? prev.score + (currentQuestion.points || 10) : prev.score,
      answeredQuestions: new Set([...prev.answeredQuestions, quizState.currentQuestionIndex]),
    }));
  };

  const handleNextQuestion = () => {
    if (quizState.currentQuestionIndex < questions.length - 1) {
      setQuizState((prev) => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        selectedAnswer: null,
        showResult: false,
        isCorrect: false,
      }));
    } else {
      // Quiz completed
      navigate("/congratulations");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 dark:text-slate-400 mt-4">Loading Quiz...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl">
          <p className="text-xl text-slate-700 dark:text-slate-300">No questions available</p>
          <Button
            onClick={() => navigate("/")}
            className="mt-4"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[quizState.currentQuestionIndex];
  const progress = ((quizState.currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <GameHeader
        gameTitle="Code Quiz Master"
        gameIcon="❓"
        team={team}
        room={null}
        extraInfo={
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-base px-3 py-1">
            Score: {quizState.score}
          </Badge>
        }
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
            <span>Question {quizState.currentQuestionIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3 bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Question Card */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="mb-8">
              <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
                {currentQuestion.points || 10} Points
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {currentQuestion.text || currentQuestion.question_text}
              </h2>
            </div>

            {/* Options */}
            <div className="grid gap-4">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={quizState.showResult}
                  className={`w-full p-5 rounded-xl text-left font-medium transition-all border-2 relative group ${quizState.showResult
                      ? index === currentQuestion.correctAnswer
                        ? "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-300 shadow-md"
                        : index === quizState.selectedAnswer
                          ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-300"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60"
                      : quizState.selectedAnswer === index
                        ? "bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-900 dark:text-purple-200 shadow-md transform scale-[1.01]"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 hover:shadow-sm"
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${quizState.showResult
                        ? index === currentQuestion.correctAnswer
                          ? "bg-green-500 border-green-600 text-white"
                          : index === quizState.selectedAnswer
                            ? "bg-red-500 border-red-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-500"
                        : quizState.selectedAnswer === index
                          ? "bg-purple-500 border-purple-600 text-white"
                          : "bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-500 group-hover:border-purple-400 group-hover:text-purple-600"
                      }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option}</span>

                    {quizState.showResult && index === currentQuestion.correctAnswer && (
                      <span className="absolute right-5 text-green-600 dark:text-green-400 text-xl">✓</span>
                    )}
                    {quizState.showResult && index === quizState.selectedAnswer && index !== currentQuestion.correctAnswer && (
                      <span className="absolute right-5 text-red-600 dark:text-red-400 text-xl">✗</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Result Message & Action */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              {quizState.showResult ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-lg ${quizState.isCorrect
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}>
                    <span className="text-2xl">{quizState.isCorrect ? "🎉" : "😢"}</span>
                    <span className="font-bold text-lg">{quizState.isCorrect ? "Correct Answer!" : "Wrong Answer"}</span>
                  </div>

                  <Button
                    onClick={handleNextQuestion}
                    size="lg"
                    className={`w-full sm:w-auto px-8 font-bold shadow-lg ${quizState.isCorrect
                        ? "bg-green-600 hover:bg-green-700 shadow-green-200 dark:shadow-green-900/20"
                        : "bg-slate-700 hover:bg-slate-800"
                      }`}
                  >
                    {quizState.currentQuestionIndex < questions.length - 1 ? "Next Question →" : "Finish Quiz"}
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={quizState.selectedAnswer === null}
                    size="lg"
                    className="w-full sm:w-auto px-8 font-bold bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 dark:shadow-purple-900/20 transition-all"
                  >
                    Submit Answer
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
