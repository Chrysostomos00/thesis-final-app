import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudentAttemptDetails } from '../../../services/api';
import Modal from '../../common/Modal';
import {
  FaSpinner, FaCheckCircle, FaTimesCircle, FaLightbulb, FaExclamationCircle
} from 'react-icons/fa';
import '../../../styles/QuizComponents.css';
import '../../../styles/StudentDashboard.css';

function QuizResultStudent() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attemptDetails, setAttemptDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const showError = useCallback((msg) => setError(msg), []);

  useEffect(() => {
    if (!attemptId) { showError("Attempt ID is missing."); setIsLoading(false); return; }
    setIsLoading(true); setError('');
    getStudentAttemptDetails(attemptId)
      .then(response => setAttemptDetails(response.data))
      .catch(err => {
        console.error(err);
        showError(err.response?.data?.error || "Could not load your quiz results.");
        setAttemptDetails(null);
      })
      .finally(() => setIsLoading(false));
  }, [attemptId, showError]);

  const handleClose = () => { navigate('/student/dashboard'); };

  const scorePct = useMemo(() => {
    const s = attemptDetails?.score;
    return typeof s === 'number' ? Math.max(0, Math.min(100, Math.round(s))) : 0;
  }, [attemptDetails]);

  if (isLoading) {
    return (
      <Modal title="Loading Results..." onClose={handleClose} width="700px">
        <div className="loading-items" style={{minHeight: '200px'}}>
          <FaSpinner className="spin" /> Loading your results...
        </div>
      </Modal>
    );
  }

  if (error || !attemptDetails) {
    return (
      <Modal title="Error" onClose={handleClose} width="500px">
        <div className="message error-message global-message" style={{ margin: 0 }}>
          <FaExclamationCircle size={24} style={{ marginRight: '10px' }} />
          {error || "Could not load quiz results."}
        </div>
      </Modal>
    );
  }

  const { total_questions, correct_answers, answers = [], quiz_title } = attemptDetails;

  return (
    <Modal title={`Results: ${quiz_title || 'Quiz'}`} onClose={handleClose} width="820px">
      <div className="quiz-result-container">
        <div className="result-summary widget">
          <div className="gauge" aria-label={`Score ${scorePct}%`}>
            <svg viewBox="0 0 120 120" width="140" height="140">
              <circle cx="60" cy="60" r="52" className="gauge-track"/>
              <circle
                cx="60" cy="60" r="52"
                className="gauge-fill"
                style={{ strokeDasharray: `${(scorePct/100)*2*Math.PI*52} ${2*Math.PI*52}` }}
              />
              <text x="60" y="66" textAnchor="middle" className="gauge-label">{scorePct}%</text>
            </svg>
            <div className="gauge-meta">
              <h3>Your Score</h3>
              <p><FaCheckCircle className="icon-correct"/> Correct: {correct_answers || 0} / {total_questions || 0}</p>
            </div>
          </div>
        </div>

        <div className="result-questions-list">
          {answers.map((answer, index) => (
            <div
              key={answer.id || index}
              className={`result-question-item ${answer.is_correct === true ? 'correct' : answer.is_correct === false ? 'incorrect' : 'ungraded'}`}
            >
              <div className="question-header">
                <h4>Question {index + 1}</h4>
                {answer.is_correct === true && <FaCheckCircle className="status-icon correct" title="Correct"/>}
                {answer.is_correct === false && <FaTimesCircle className="status-icon incorrect" title="Incorrect"/>}
              </div>

              <p className="question-text-result">{answer.question_text || "Question text not available."}</p>

              <p className="student-answer-result">
                <strong>Your Answer:</strong> {answer.answer_text || "Not answered"}
              </p>

              {answer.is_correct === false && answer.ai_feedback && (
                <div className="ai-feedback-result">
                  <p><strong><FaLightbulb /> AI Feedback:</strong> {answer.ai_feedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default QuizResultStudent;
