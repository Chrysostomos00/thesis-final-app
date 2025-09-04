// frontend/src/components/Quiz/Teacher/QuizAnalytics.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTeacherQuizDetails, getTeacherQuizAttempts } from '../../../services/api';
import { FaArrowLeft, FaChartBar, FaSpinner, FaUsers, FaCheckCircle, FaPercentage, FaQuestionCircle, FaRegListAlt } from 'react-icons/fa';
import '../../../styles/QuizComponents.css'; // Styles for analytics
import '../../../styles/TeacherDashboard.css'; // General dashboard styles

function QuizAnalytics() {
    const { quizId } = useParams();
    const [quizDetails, setQuizDetails] = useState(null);
    const [attempts, setAttempts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // --- Helper to calculate overall and per-question stats ---
    const calculateAnalytics = useCallback((quiz, studentAttempts) => {
        if (!quiz || !quiz.questions || studentAttempts.length === 0) {
            return {
                averageScore: 0,
                totalAttempts: studentAttempts.length,
                completionRate: 0, // Needs total assigned students for true rate
                questionStats: quiz?.questions?.map(q => ({ id: q.id, text: q.question_text, correctPercentage: 0, totalAnswers: 0, correctAnswers: 0 })) || []
            };
        }

        let totalScoreSum = 0;
        const questionStatsMap = {};
        quiz.questions.forEach(q => {
            questionStatsMap[q.id] = {
                id: q.id,
                text: q.question_text,
                type: q.question_type,
                correctPercentage: 0,
                totalAnswers: 0, // Total students who answered this question
                correctAnswers: 0, // Total students who answered this question correctly
                // choices: q.choices // Could be used for most common wrong answers later
            };
        });

        studentAttempts.forEach(attempt => {
            if (attempt.score !== null) {
                totalScoreSum += attempt.score;
            }
            // Assuming attempt.answers is an array of { question_id, is_correct, answer_text }
            // This part depends on the structure returned by /api/teachers/quizzes/<quiz_id>/attempts
            // For now, we'll assume the main attempt object has score, and we might need to fetch individual answer details if not directly available.
            // Let's assume the backend `/api/teachers/quizzes/<quiz_id>/attempts` returns attempts with basic score,
            // and we can't easily get per-question correctness without fetching each attempt's full details.
            // So, per-question stats will be simplified for now.
            // A more advanced version would fetch all StudentAnswer records for this quiz.
        });

        // For per-question stats, we'd ideally query StudentAnswer table aggregated by question_id for this quiz.
        // This is a simplified placeholder if we don't have that endpoint yet.
        // The current `getTeacherQuizAttempts` returns list of StudentQuizAttempt. We need details of their answers.
        // This will be an area for future backend improvement. For now, focus on overall stats.

        return {
            averageScore: studentAttempts.length > 0 ? (totalScoreSum / studentAttempts.length) : 0,
            totalAttempts: studentAttempts.length,
            questionStats: Object.values(questionStatsMap) // Placeholder for now
        };
    }, []);


    const [analyticsData, setAnalyticsData] = useState(null);

    useEffect(() => {
        if (!quizId) {
            setError("Quiz ID is missing.");
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError('');
            try {
                // Fetch quiz details (to get title, questions etc.)
                const quizDetailsRes = await getTeacherQuizDetails(quizId);
                setQuizDetails(quizDetailsRes.data);
                console.log("Quiz Details for Analytics:", quizDetailsRes.data);

                // Fetch all student attempts for this quiz
                const attemptsRes = await getTeacherQuizAttempts(quizId);
                setAttempts(attemptsRes.data || []);
                console.log("Quiz Attempts for Analytics:", attemptsRes.data);

                // Calculate analytics once both are fetched
                if (quizDetailsRes.data && attemptsRes.data) {
                    setAnalyticsData(calculateAnalytics(quizDetailsRes.data, attemptsRes.data));
                }

            } catch (err) {
                console.error("Error fetching quiz analytics data:", err);
                setError(err.response?.data?.error || "Could not load quiz analytics.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [quizId, calculateAnalytics]); // Add calculateAnalytics to dependencies


    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try { return new Date(dateString).toLocaleString(); } // Full date and time
        catch (e) { return dateString; }
    };


    if (isLoading) {
        return <div className="loading-fullscreen"><FaSpinner className="spin" /> Loading Analytics...</div>;
    }
    if (error) {
        return (
            <div className="page-content-wrapper">
                <div className="page-header">
                    <Link to="/teacher/dashboard/quizzes" className='subtle-button back-button'><FaArrowLeft /> Back to Quizzes</Link>
                </div>
                <div className="message error-message global-message">{error}</div>
            </div>
        );
    }
    if (!quizDetails || !analyticsData) {
        return <div className="page-content-wrapper"><p>No analytics data available for this quiz.</p></div>;
    }


    return (
        <div className="quiz-analytics-page page-content-wrapper">
            <div className="page-header">
                <Link to="/teacher/dashboard/quizzes" className='subtle-button back-button'>
                    <FaArrowLeft /> Back to Quizzes
                </Link>
                <h2><FaChartBar /> Analytics for: {quizDetails.title}</h2>
            </div>

            {/* --- Summary Statistics --- */}
            <div className="analytics-summary-cards">
                <div className="summary-card">
                    <FaUsers className="summary-card-icon" />
                    <div className="summary-card-value">{analyticsData.totalAttempts}</div>
                    <div className="summary-card-label">Total Attempts</div>
                </div>
                <div className="summary-card">
                    <FaPercentage className="summary-card-icon" />
                    <div className="summary-card-value">{analyticsData.averageScore.toFixed(1)}%</div>
                    <div className="summary-card-label">Average Score</div>
                </div>
                {/* Add more summary cards: e.g., Pass Rate (if defined), Most Difficult Question (later) */}
            </div>

            {/* --- List of Student Attempts --- */}
            <div className="widget attempts-list-widget">
                <h3><FaRegListAlt/> Student Attempts</h3>
                {attempts.length === 0 ? (
                    <p className="empty-list-message">No students have attempted this quiz yet.</p>
                ) : (
                    <div className="table-container">
                        <table className="quiz-table analytics-table">
                            <thead>
                                <tr>
                                    <th>Student Email</th>
                                    <th>Score</th>
                                    <th>Correct</th>
                                    <th>Total Qs</th>
                                    <th>Submitted On</th>
                                    {/*<th>Actions</th> */}
                                </tr>
                            </thead>
                            <tbody>
                                {attempts.map(attempt => (
                                    <tr key={attempt.id}>
                                        <td data-label="Student">{attempt.student_email || 'N/A'}</td>
                                        <td data-label="Score">
                                            <span className={`score-badge score-${attempt.score >= 70 ? 'high' : attempt.score >= 40 ? 'medium' : 'low'}`}>
                                                {attempt.score !== null ? `${attempt.score.toFixed(0)}%` : 'N/A'}
                                            </span>
                                        </td>
                                        <td data-label="Correct">{attempt.correct_answers ?? '?'}</td>
                                        <td data-label="Total Qs">{attempt.total_questions ?? quizDetails.question_count ?? '?'}</td>
                                        <td data-label="Submitted">{formatDate(attempt.submitted_at)}</td>
                                        {/* <td data-label="Actions">
                                            <Link to={`/teacher/dashboard/attempts/${attempt.id}/details`} className="subtle-button">View Details</Link>
                                        </td> */}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- Per-Question Statistics (Simplified for now) --- */}
            {/* This section will need more backend work to be truly useful (aggregating all StudentAnswer records) */}
            {/* <div className="widget question-stats-widget">
                <h3><FaQuestionCircle/> Question Performance (Overview)</h3>
                {analyticsData.questionStats.length === 0 ? (
                    <p>No question data available.</p>
                ) : (
                    <ul>
                        {analyticsData.questionStats.map(qStat => (
                            <li key={qStat.id}>
                                <strong>Q: {qStat.text.substring(0,60)}...</strong> - Correct: {qStat.correctPercentage.toFixed(0)}%
                            </li>
                        ))}
                    </ul>
                )}
            </div> */}
        </div>
    );
}

export default QuizAnalytics;