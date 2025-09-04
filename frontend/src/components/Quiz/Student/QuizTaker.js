import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { takeStudentQuiz, submitStudentQuiz } from '../../../services/api';
import { FaSpinner, FaPaperPlane, FaExclamationCircle, FaRegCircle, FaCheckCircle } from 'react-icons/fa';
import '../../../styles/StudentDashboard.css';
import '../../../styles/QuizComponents.css';

function QuizTaker() {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [quizData, setQuizData] = useState(null);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pageTopRef = useRef(null);

  const showError = useCallback((msg) => setError(msg), []);

  useEffect(() => {
    const fetchQuizToTake = async () => {
      if (!quizId) { showError("Quiz ID is missing."); setIsLoading(false); return; }
      setIsLoading(true); setError('');
      try {
        const response = await takeStudentQuiz(quizId);
        if (response.data && response.data.questions) {
          setQuizData(response.data);
          // initial answers (restore from localStorage if present)
          const saved = localStorage.getItem(`quiz_${quizId}_answers`);
          if (saved) {
            setStudentAnswers(JSON.parse(saved));
          } else {
            const initial = {};
            response.data.questions.forEach(q => { initial[q.id] = null; });
            setStudentAnswers(initial);
          }
        } else {
          throw new Error("Quiz data or questions missing in API response.");
        }
      } catch (err) {
        console.error("Error fetching quiz for student:", err);
        showError(err.response?.data?.error || "Could not load the quiz. It might not be available or an error occurred.");
        setQuizData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuizToTake();
  }, [quizId, showError]);

  // autosave answers
  useEffect(() => {
    if (quizId) localStorage.setItem(`quiz_${quizId}_answers`, JSON.stringify(studentAnswers));
  }, [quizId, studentAnswers]);

  // confirm on unload if not submitted
  useEffect(() => {
    const beforeUnload = (e) => {
      if (!isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [isSubmitting]);

  const handleAnswerSelect = (questionId, choiceId) => {
    setStudentAnswers(prev => ({ ...prev, [questionId]: choiceId }));
  };

  const handleSubmitQuiz = async () => {
    const unanswered = quizData.questions.filter(q => studentAnswers[q.id] === null || studentAnswers[q.id] === undefined);
    if (unanswered.length > 0) {
      if (!window.confirm(`You have ${unanswered.length} unanswered question(s). Are you sure you want to submit?`)) return;
    }

    setIsSubmitting(true); setError('');

    // transform to expected payload: choice_text
    const payload = {};
    for (const question of quizData.questions) {
      const selectedChoiceId = studentAnswers[question.id];
      if (selectedChoiceId) {
        const selectedChoice = question.choices.find(c => c.id === selectedChoiceId);
        payload[question.id] = selectedChoice ? selectedChoice.choice_text : null;
      } else {
        payload[question.id] = null;
      }
    }

    try {
      const response = await submitStudentQuiz(quizId, payload);
      // gamify: +20 XP per quiz submit
      const xp = parseInt(localStorage.getItem('student_xp') || '0', 10) + 20;
      localStorage.setItem('student_xp', String(xp));
      localStorage.setItem('student_last_active', new Date().toISOString().slice(0,10));

      localStorage.removeItem(`quiz_${quizId}_answers`);
      if (response.data && response.data.id) navigate(`/student/dashboard/attempts/${response.data.id}`);
      else navigate('/student/dashboard');
    } catch (err) {
      console.error("Error submitting quiz:", err);
      showError(err.response?.data?.error || "Failed to submit your answers. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-fullscreen">
        <FaSpinner className="spin" /> Loading Quiz...
      </div>
    );
  }

  if (error && !quizData) {
    return (
      <div className="page-content-wrapper quiz-taker-error">
        <div className="message error-message global-message">
          <FaExclamationCircle size={24} />
          <div>
            <h4>Error Loading Quiz</h4>
            <p>{error}</p>
            <Link to="/student/dashboard" className='button subtle-button'>Back to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }
  if (!quizData) return <div className="page-content-wrapper"><p>No quiz data available.</p></div>;

  const total = quizData.questions.length;
  const answeredCount = Object.values(studentAnswers).filter(v => v !== null && v !== undefined).length;
  const progressPct = Math.round((answeredCount / total) * 100);

  const scrollToQ = (qid) => {
    const el = document.getElementById(`q_${qid}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="quiz-taker-page page-content-wrapper" ref={pageTopRef}>
      <div className="page-header">
        <h2>{quizData.title}</h2>
        <div className="quiz-progress" aria-label={`Progress ${progressPct}%`}>
          <div className="bar"><div className="fill" style={{ width: `${progressPct}%` }} /></div>
          <span className="label">{answeredCount}/{total} answered</span>
        </div>
      </div>

      {quizData.description && <p className="quiz-description-taker">{quizData.description}</p>}
      {error && <div className="message error-message global-message" style={{marginBottom: '1rem'}}>{error}</div>}

      {/* Jump navigation */}
      <div className="question-jump-nav widget" role="navigation" aria-label="Jump to question">
        {quizData.questions.map((q, idx) => {
          const done = !!studentAnswers[q.id];
          return (
            <button
              key={q.id}
              type="button"
              className={`q-dot ${done ? 'done' : ''}`}
              title={`Go to question ${idx+1}`}
              onClick={() => scrollToQ(q.id)}
            >
              {idx+1}
            </button>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmitQuiz(); }}>
        {quizData.questions.map((question, index) => (
          <div key={question.id} id={`q_${question.id}`} className="quiz-question-block widget">
            <h4>Question {index + 1}</h4>
            <p className="question-text-taker">{question.question_text}</p>

            {question.question_type === 'mcq' && (
              <div className="choices-group">
                {question.choices.map(choice => (
                  <label
                    key={choice.id}
                    className={`choice-label ${studentAnswers[question.id] === choice.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={choice.id}
                      checked={studentAnswers[question.id] === choice.id}
                      onChange={() => handleAnswerSelect(question.id, choice.id)}
                      className="choice-radio"
                    />
                    {studentAnswers[question.id] === choice.id
                      ? <FaCheckCircle className="choice-icon selected"/>
                      : <FaRegCircle className="choice-icon"/>}
                    <span className="choice-text">{choice.choice_text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="quiz-submit-area sticky">
          <button type="submit" className="button primary-button large-button" disabled={isSubmitting}>
            {isSubmitting ? <><FaSpinner className="spin" /> Submitting...</> : <><FaPaperPlane /> Submit Answers</>}
          </button>
        </div>
      </form>
    </div>
  );
}

export default QuizTaker;
