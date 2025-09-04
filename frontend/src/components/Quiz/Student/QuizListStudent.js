import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getStudentQuizzes } from '../../../services/api';
import {
  FaClipboardList, FaSpinner, FaCheckCircle, FaPlayCircle, FaFilter, FaSearch
} from 'react-icons/fa';
import '../../../styles/StudentDashboard.css';
import '../../../styles/QuizComponents.css';

function QuizListStudent() {
  const [quizzes, setQuizzes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | available | completed
  const [search, setSearch] = useState('');

  const showError = useCallback((msg) => setError(msg), []);

  const fetchQuizzes = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const response = await getStudentQuizzes();
      const quizzesData = response.data || [];
      if (!Array.isArray(quizzesData)) throw new Error("Invalid data format received from server.");
      setQuizzes(quizzesData);
    } catch (err) {
      console.error("Error fetching student quizzes:", err);
      showError(err.response?.data?.error || "Could not load quizzes.");
      setQuizzes([]);
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  const counts = useMemo(() => {
    const completed = quizzes.reduce((acc, q) => acc + (q?.student_attempt?.submitted_at ? 1 : 0), 0);
    return {
      all: quizzes.length,
      completed,
      available: Math.max(0, quizzes.length - completed),
    };
  }, [quizzes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quizzes.filter(q => {
      const isCompleted = !!q?.student_attempt?.submitted_at;
      if (filter === 'available' && isCompleted) return false;
      if (filter === 'completed' && !isCompleted) return false;
      if (term && !((q.title||'').toLowerCase().includes(term) || (q.description||'').toLowerCase().includes(term))) return false;
      return true;
    });
  }, [quizzes, filter, search]);

  return (
    <div className='quiz-list-student'>
      <div className='page-header no-border'>
        <h2><FaClipboardList /> Available Quizzes</h2>
        <button className="button subtle-button" onClick={fetchQuizzes} aria-label="Refresh quizzes">
          ↻ Refresh
        </button>
      </div>

      <div className="toolbar-row wrap-on-narrow">
        <div className="input-with-icon">
          <FaSearch />
          <input
            type="text"
            placeholder="Search quizzes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search quizzes"
          />
        </div>

        <div className="filter-group" role="tablist" aria-label="Filter quizzes">
          <span className="filter-label"><FaFilter/> Filter:</span>
          <button
            className={`pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
            role="tab"
            aria-selected={filter === 'all'}
          >
            All <span className="pill-count">{counts.all}</span>
          </button>
          <button
            className={`pill ${filter === 'available' ? 'active' : ''}`}
            onClick={() => setFilter('available')}
            role="tab"
            aria-selected={filter === 'available'}
          >
            Available <span className="pill-count">{counts.available}</span>
          </button>
          <button
            className={`pill ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
            role="tab"
            aria-selected={filter === 'completed'}
          >
            Completed <span className="pill-count">{counts.completed}</span>
          </button>
        </div>
      </div>

      {error && <div className="message error-message global-message">{error}</div>}

      {isLoading && (
        <div className='items-grid'>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="item-card skeleton">
              <div className="s-line wide" />
              <div className="s-line" />
              <div className="s-line short" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className='empty-state'>
          <p className='no-items-message'>No quizzes match your filters.</p>
          <button className="button subtle-button" onClick={() => { setFilter('all'); setSearch(''); }}>
            Clear filters
          </button>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className='items-grid'>
          {filtered.map(quiz => {
            if (!quiz || !quiz.id) return null;
            const isCompleted = !!quiz.student_attempt?.submitted_at;
            const scoreDisplay = isCompleted && quiz.student_attempt?.score !== null
              ? `${quiz.student_attempt.score.toFixed(0)}%`
              : 'Completed';
            const estMinutes = quiz.question_count ? Math.max(1, Math.round(quiz.question_count * 0.5)) : 5;

            return (
              <div key={quiz.id} className={`item-card quiz-card ${isCompleted ? 'completed' : ''}`} title={quiz.title}>
                <div className="item-card-header">
                  <FaClipboardList className="item-card-icon"/>
                  <h3 className="item-card-title">{quiz.title || 'Unnamed Quiz'}</h3>
                </div>

                <p className="item-card-description">{quiz.description || 'No description provided.'}</p>

                <div className="quiz-item-details">
                  <span className="meta">{quiz.question_count ?? '?'} Questions · ~{estMinutes} min</span>
                  {isCompleted && (
                    <span className='quiz-completed-status' aria-label={`Score ${scoreDisplay}`}>
                      <FaCheckCircle/> {scoreDisplay}
                    </span>
                  )}
                </div>

                <div className='item-card-footer'>
                  {isCompleted ? (
                    <Link to={`/student/dashboard/attempts/${quiz.student_attempt.id}`} className="button secondary-button">
                      View Results
                    </Link>
                  ) : (
                    <Link to={`/student/dashboard/quizzes/take/${quiz.id}`} className="button primary-button">
                      <FaPlayCircle/> Start Quiz
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default QuizListStudent;
