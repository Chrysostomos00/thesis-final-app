import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom'; // useNavigate was unused
import { getTeacherQuizzes, deleteTeacherQuiz, updateTeacherQuiz, getTeacherQuizDetails } from '../../../services/api';
// Removed FaCopy as it was unused
import { FaPlus, FaEdit, FaTrash, FaChartBar, FaEye, FaEyeSlash, FaSpinner, FaClipboardList } from 'react-icons/fa';
// Ensure CSS paths are correct from the perspective of this file
import '../../../styles/QuizComponents.css';
import '../../../styles/TeacherDashboard.css'; // For .page-header, .widget, table styles

function QuizListTeacher() {
    const [quizzes, setQuizzes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // --- State for local messages within this component ---
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    // --- End State for local messages ---
    const [actionLoading, setActionLoading] = useState({ type: null, id: null }); // For button spinners

    // --- Helper functions for messages (defined inside this component's scope) ---
    const clearMessages = useCallback(() => {
        setError('');
        setSuccess('');
    }, []);

    const showSuccess = useCallback((msg) => {
        setSuccess(msg);
        setError(''); // Clear any previous error
        setTimeout(clearMessages, 3500); // Auto-clear success after 3.5s
    }, [clearMessages]);

    const showError = useCallback((msg) => {
        setError(msg);
        setSuccess(''); // Clear any previous success
        // Errors are not auto-cleared by default
    }, [clearMessages]); // Added clearMessages here just in case, though not strictly necessary if showError doesn't call it.

    // --- Function to fetch quizzes for the teacher ---
    const fetchQuizzes = useCallback(async () => {
        setIsLoading(true);
        clearMessages(); // Clear any old messages before fetching
        try {
            const response = await getTeacherQuizzes();
            setQuizzes(response.data || []);
        } catch (err) {
            console.error("Error fetching teacher quizzes:", err);
            showError(err.response?.data?.error || "Could not load your quizzes. Please try again.");
            setQuizzes([]); // Set to empty array on error
        } finally {
            setIsLoading(false);
        }
    }, [showError, clearMessages]); // fetchQuizzes depends on showError and clearMessages

    useEffect(() => {
        fetchQuizzes();
    }, [fetchQuizzes]); // Run fetchQuizzes when component mounts or fetchQuizzes function reference changes

    // --- Action Handlers wrapped in useCallback ---
    const handleDelete = useCallback(async (quizId, quizTitle) => {
        if (!window.confirm(`Are you sure you want to delete the quiz "${quizTitle}"? This will also delete all student attempts and cannot be undone.`)) {
            return;
        }
        setActionLoading({ type: 'delete', id: quizId });
        clearMessages();
        try {
            await deleteTeacherQuiz(quizId);
            showSuccess(`Quiz "${quizTitle}" deleted successfully.`);
            await fetchQuizzes(); // Refresh the list from the backend
        } catch (err) {
            console.error("Delete quiz failed:", err);
            showError(err.response?.data?.error || "Failed to delete quiz.");
        } finally {
            setActionLoading(prev => (prev.id === quizId ? { type: null, id: null } : prev));
        }
    }, [fetchQuizzes, showError, showSuccess, clearMessages]);

    const handleTogglePublish = useCallback(async (quiz) => {
        const newPublishStatus = !quiz.is_published;
        if (!window.confirm(`Are you sure you want to ${newPublishStatus ? 'publish' : 'unpublish'} the quiz "${quiz.title}"?`)) {
            return;
        }
        setActionLoading({ type: 'publish', id: quiz.id });
        clearMessages();

        let updatePayload;
        try {
            // To safely update only 'is_published', we MUST provide all other fields
            // that the backend PUT /api/quizzes/:id expects, or it might nullify them.
            // Best practice: fetch full quiz details for PUT if not just a PATCH operation.
            console.log(`Fetching full details for quiz "${quiz.title}" (ID: ${quiz.id}) before toggle.`);
            const detailsResponse = await getTeacherQuizDetails(quiz.id);
            const fullQuizData = detailsResponse.data;

            if (!fullQuizData || !Array.isArray(fullQuizData.questions)) {
                throw new Error("Fetched quiz details are incomplete or invalid for update.");
            }

            updatePayload = {
                title: fullQuizData.title,
                description: fullQuizData.description || "",
                is_published: newPublishStatus,
                questions: fullQuizData.questions // Send the full questions array as is from fetched details
            };
            console.log("Sending full update payload for publish toggle:", updatePayload);

            await updateTeacherQuiz(quiz.id, updatePayload);
            showSuccess(`Quiz "${quiz.title}" visibility updated to ${newPublishStatus ? 'Published' : 'Draft'}.`);
            await fetchQuizzes(); // Fetch updated list to reflect changes reliably
        } catch (err) {
            console.error("Toggle publish failed:", err);
            showError(err.response?.data?.error || `Failed to ${newPublishStatus ? 'publish' : 'unpublish'} quiz.`);
            // No optimistic revert, fetchQuizzes will get the true state eventually
        } finally {
            setActionLoading(prev => (prev.id === quiz.id ? { type: null, id: null } : prev));
        }
    }, [fetchQuizzes, showError, showSuccess, clearMessages]);
    // --- End Action Handlers ---

    const formatDate = (dateString) => {
         if (!dateString) return 'N/A';
         try { return new Date(dateString).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } // Greek date format
         catch (e) { return dateString; }
    };

    if (isLoading) {
        return (
             <div className="page-content-wrapper"> {/* Match wrapper class */}
                 <div className='loading-items'><FaSpinner className='spin' /> Loading Your Quizzes...</div>
            </div>
        );
    }

    return (
        <div className="quiz-list-page teacher-view page-content-wrapper">
             <div className="page-header">
                 <h2><FaClipboardList /> Διαχείρηση Κουιζ</h2>
                 <Link to="/teacher/dashboard/quizzes/new" className="button primary-button">
                     <FaPlus /> Δημιουργία  Κουίζ
                 </Link>
             </div>

            {error && <div className="message error-message global-message">{error}<button onClick={clearMessages}>X</button></div>}
            {success && <div className="message success-message global-message">{success}<button onClick={clearMessages}>X</button></div>}

            {quizzes.length === 0 ? ( // Check after loading is done
                <p className="empty-list-message">Δεν έχετε δημιουργήσει ακόμα κάποιο Κουιζ. Πατήστε "Δημιουργία Κουίζ" για να ξεκινήσετε!</p>
            ) : (
                <div className="table-container">
                    <table className="quiz-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th style={{maxWidth: "250px"}}>Description</th>
                                <th style={{textAlign: "center"}}>Questions</th>
                                <th style={{textAlign: "center"}}>Status</th>
                                <th>Created On</th>
                                <th style={{width: "160px", textAlign: "center"}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quizzes.map(quiz => (
                                <tr key={quiz.id}>
                                    <td data-label="Title" className="quiz-title" title={quiz.title}>
                                        <Link to={`/teacher/dashboard/quizzes/edit/${quiz.id}`}>{quiz.title}</Link>
                                    </td>
                                    <td data-label="Description" className="quiz-description" title={quiz.description || 'No description'}>
                                        {quiz.description?.substring(0, 60)}{quiz.description?.length > 60 ? '...' : ''}
                                    </td>
                                    <td data-label="Questions" style={{textAlign: "center"}}>{quiz.question_count ?? '?'}</td>
                                    <td data-label="Status" style={{textAlign: "center"}}>
                                        <button
                                            onClick={() => handleTogglePublish(quiz)}
                                            className={`status-toggle-btn subtle-button ${quiz.is_published ? 'published' : 'draft'}`}
                                            disabled={actionLoading.type === 'publish' && actionLoading.id === quiz.id}
                                            title={`Click to ${quiz.is_published ? 'Unpublish' : 'Publish'}`}
                                        >
                                            {actionLoading.type === 'publish' && actionLoading.id === quiz.id ? (
                                                <FaSpinner className="spin" size="0.9em"/>
                                            ) : quiz.is_published ? (
                                                <><FaEye /> Published</>
                                            ) : (
                                                <><FaEyeSlash /> Draft</>
                                            )}
                                        </button>
                                    </td>
                                    <td data-label="Created">{formatDate(quiz.created_at)}</td>
                                    <td data-label="Actions" className="quiz-actions">
                                         <Link to={`/teacher/dashboard/quizzes/edit/${quiz.id}`} className="action-button subtle-button edit" title="Edit Quiz">
                                             <FaEdit />
                                         </Link>
                                          <Link to={`/teacher/dashboard/quizzes/results/${quiz.id}`} className="action-button subtle-button results" title="View Results">
                                             <FaChartBar />
                                         </Link>
                                        <button
                                            onClick={() => handleDelete(quiz.id, quiz.title)}
                                            className="action-button subtle-button delete"
                                            disabled={actionLoading.type === 'delete' && actionLoading.id === quiz.id}
                                            title="Delete Quiz"
                                        >
                                             {actionLoading.type === 'delete' && actionLoading.id === quiz.id ? <FaSpinner className="spin" size="0.9em"/> : <FaTrash />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default QuizListTeacher;