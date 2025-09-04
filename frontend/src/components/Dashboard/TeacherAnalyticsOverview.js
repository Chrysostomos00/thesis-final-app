// frontend/src/components/Dashboard/TeacherAnalyticsOverview.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeacherQuizzes } from '../../services/api'; // We need to fetch quizzes
import { FaChartBar, FaSpinner, FaSearch, FaEye, FaEyeSlash } from 'react-icons/fa';
// Styles can be shared or new
import '../../styles/TeacherDashboard.css'; // For .page-header, .widget etc.
import '../../styles/QuizComponents.css';   // For .quiz-table or .items-grid if reusing

function TeacherAnalyticsOverview() {
    const [quizzes, setQuizzes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const fetchQuizzesForAnalytics = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getTeacherQuizzes();
            setQuizzes(response.data || []);
        } catch (err) {
            console.error("Error fetching quizzes for analytics:", err);
            setError(err.response?.data?.error || "Could not load your quizzes list.");
            setQuizzes([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuizzesForAnalytics();
    }, [fetchQuizzesForAnalytics]);

    const handleQuizSelect = (quizId) => {
        navigate(`/teacher/dashboard/quizzes/results/${quizId}`);
    };

    const filteredQuizzes = quizzes.filter(quiz =>
        quiz.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="teacher-analytics-overview-page page-content-wrapper">
            <div className="page-header">
                <h2><FaChartBar /> Quiz Analytics Overview</h2>
                {/* Maybe add filters or general stats here later */}
            </div>

            {error && <div className="message error-message global-message">{error}</div>}

            <div className="widget">
                <h3><FaSearch /> Select a Quiz to View Analytics</h3>
                <div className="form-group" style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
                    <input
                        type="text"
                        placeholder="Search quizzes by title..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className='loading-items' style={{minHeight: '200px'}}>
                        <FaSpinner className='spin' /> Loading quizzes...
                    </div>
                ) : filteredQuizzes.length === 0 ? (
                    <p className='empty-list-message'>
                        {quizzes.length === 0 ? "You haven't created any quizzes yet." : "No quizzes match your search."}
                    </p>
                ) : (
                    <ul className="analytics-quiz-selection-list">
                        {filteredQuizzes.map(quiz => (
                            <li key={quiz.id} onClick={() => handleQuizSelect(quiz.id)}>
                                <div className="quiz-info">
                                    <span className="quiz-title">{quiz.title}</span>
                                    <span className="quiz-meta">
                                        {quiz.question_count || 0} Questions
                                        {quiz.is_published ? <span className="status published"><FaEye/> Published</span> : <span className="status draft"><FaEyeSlash/> Draft</span>}
                                    </span>
                                </div>
                                <button className="button subtle-button">View Analytics</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default TeacherAnalyticsOverview;