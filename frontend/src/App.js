import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// --- Core Components ---
import RoleSelector from './components/common/RoleSelector';
import NotFound from './components/common/NotFound';

// >> CHANGE: Import the new unified AuthPage component
import AuthPage from './components/Auth/AuthPage';

// --- Teacher Components ---
import TeacherDashboardLayout from './components/Dashboard/TeacherDashboard';
import TeacherOverview from './components/Dashboard/TeacherOverview';
import PromptWorkshop from './components/Dashboard/PromptWorkshop';
import MaterialManagerPage from './components/Dashboard/MaterialManagerPage';
import QuizListTeacher from './components/Quiz/Teacher/QuizListTeacher';
import QuizBuilder from './components/Quiz/Teacher/QuizBuilder';
import TeacherAnalyticsOverview from './components/Dashboard/TeacherAnalyticsOverview';
import QuizAnalytics from './components/Quiz/Teacher/QuizAnalytics';

// --- Student Components ---
import StudentDashboard from './components/StudentDashboard/StudentDashboard';
import QuizTaker from './components/Quiz/Student/QuizTaker';
import QuizResultStudent from './components/Quiz/Student/QuizResultStudent';

import './styles/App.css';

// --- Route Guards (No changes needed here) ---
function ProtectedRoute({ children, allowedRoles }) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <div className="loading-fullscreen">Έλεγχος Αυθεντικοποίησης...</div>;
    }

    if (!isAuthenticated) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to. This allows us to send them along to that page after they login.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        // If the user's role is not allowed for this route, redirect them
        console.warn(`Access denied: Role ${user?.role} for ${location.pathname}. Allowed: ${allowedRoles.join(', ')}`);
        const fallbackPath = user?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
        return <Navigate to={fallbackPath} replace />;
    }

    return children;
}

function PublicRoute({ children }) {
    const { isAuthenticated, isLoading, user } = useAuth();
    if (isLoading) {
        return <div className="loading-fullscreen">Φόρτωση...</div>;
    }

    if (isAuthenticated) {
        // If the user is already authenticated, redirect them from public auth pages
        const redirectPath = user?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
        return <Navigate to={redirectPath} replace />;
    }
    return children;
}

// --- Main App Content with Routing ---
function AppContent() {
    const { isLoading } = useAuth();
    if (isLoading) {
        return <div className="loading-fullscreen">Αρχικοποίηση...</div>;
    }

    return (
        <Routes>
            {/* --- Public Routes --- */}
            <Route path="/" element={<PublicRoute><RoleSelector /></PublicRoute>} />
            
            {/* >> CHANGE: Use the new AuthPage for all auth routes */}
            <Route path="/teacher/login" element={<PublicRoute><AuthPage /></PublicRoute>} />
            <Route path="/teacher/register" element={<PublicRoute><AuthPage /></PublicRoute>} />
            <Route path="/student/login" element={<PublicRoute><AuthPage /></PublicRoute>} />
            <Route path="/student/register" element={<PublicRoute><AuthPage /></PublicRoute>} />
            {/* << END CHANGE */}

            <Route path="/login" element={<PublicRoute><RoleSelector /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RoleSelector /></PublicRoute>} />

            {/* --- Protected Teacher Route with Nested Layout --- */}
            <Route
                path="/teacher/dashboard"
                element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboardLayout /></ProtectedRoute>}
            >
                <Route index element={<TeacherOverview />} />
                <Route path="prompts" element={<PromptWorkshop />} />
                <Route path="quizzes" element={<QuizListTeacher />} />
                <Route path="quizzes/new" element={<QuizBuilder />} />
                <Route path="quizzes/edit/:quizId" element={<QuizBuilder />} />
                <Route path="quizzes/results/:quizId" element={<ProtectedRoute allowedRoles={['teacher']}><QuizAnalytics /></ProtectedRoute>} />
                <Route path="materials" element={<MaterialManagerPage />} />
                <Route path="analytics" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAnalyticsOverview /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
            </Route>

            {/* --- Protected Student Routes --- */}
            <Route
                path="/student/dashboard"
                element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>}
            />
            <Route
                path="/student/dashboard/quizzes/take/:quizId"
                element={<ProtectedRoute allowedRoles={['student']}><QuizTaker /></ProtectedRoute>}
            />
            <Route
                path="/student/dashboard/attempts/:attemptId"
                element={<ProtectedRoute allowedRoles={['student']}><QuizResultStudent /></ProtectedRoute>}
            />

            {/* --- Fallback Route (Top Level) --- */}
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}

// --- Root App Component ---
function App() {
    return (
        <Router>
            <AuthProvider>
                <div className="App">
                    <AppContent />
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;