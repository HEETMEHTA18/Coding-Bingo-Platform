import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Question, Team } from "@shared/api";
import { apiFetch } from "../../lib/api";

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
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[quizState.currentQuestionIndex];
  const progress = ((quizState.currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">❓ Code Quiz Master</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Team: {team?.team_name}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{quizState.score}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Score</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
              <span>Question {quizState.currentQuestionIndex + 1} of {questions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {currentQuestion.text || currentQuestion.question_text}
            </h2>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={quizState.showResult}
                className={`w-full p-4 rounded-xl text-left font-medium transition-all border-2 ${
                  quizState.showResult
                    ? index === currentQuestion.correctAnswer
                      ? "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-800 dark:text-green-300"
                      : index === quizState.selectedAnswer
                      ? "bg-red-100 dark:bg-red-900/30 border-red-500 text-red-800 dark:text-red-300"
                      : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                    : quizState.selectedAnswer === index
                    ? "bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-900 dark:text-purple-200"
                    : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                }`}
              >
                <span className="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
                {option}
              </button>
            ))}
          </div>

          {/* Result Message */}
          {quizState.showResult && (
            <div className={`mt-6 p-4 rounded-xl ${
              quizState.isCorrect
                ? "bg-green-100 dark:bg-green-900/30 border-2 border-green-500"
                : "bg-red-100 dark:bg-red-900/30 border-2 border-red-500"
            }`}>
              <p className={`font-bold ${
                quizState.isCorrect ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
              }`}>
                {quizState.isCorrect ? "✅ Correct!" : "❌ Incorrect"}
              </p>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-6">
            {!quizState.showResult ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={quizState.selectedAnswer === null}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl"
              >
                {quizState.currentQuestionIndex < questions.length - 1 ? "Next Question →" : "Complete Quiz 🎉"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
