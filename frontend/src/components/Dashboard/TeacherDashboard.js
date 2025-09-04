import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FaRobot, FaClipboardList, FaChartBar, FaBook, FaSignOutAlt, FaTachometerAlt } from 'react-icons/fa';
import '../../styles/TeacherDashboard.css';

function TeacherDashboard() {
    const { user, logout } = useAuth();
    const location = useLocation();

    // Function to determine if a nav link should be active
    const getNavLinkClass = (path) => {
        if (path === '/teacher/dashboard') {
            return location.pathname === path ? 'nav-link active' : 'nav-link';
        }
        return location.pathname.startsWith(path) ? 'nav-link active' : 'nav-link';
    };

    return (
        <div className="teacher-dashboard">
            <header className="dashboard-header">
                <div className="header-brand">
                    <FaTachometerAlt />
                    <h1>Πύλη Εκπαιδευτικού</h1>
                </div>

                <nav className="teacher-main-nav">
                     <Link to="/teacher/dashboard" className={getNavLinkClass('/teacher/dashboard')}>
                         <FaTachometerAlt/> Κεντρική
                    </Link>
                    <Link to="/teacher/dashboard/prompts" className={getNavLinkClass('/teacher/dashboard/prompts')}>
                         <FaRobot/> Εργαστήρι AI Βοηθών
                    </Link>
                    <Link to="/teacher/dashboard/quizzes" className={getNavLinkClass('/teacher/dashboard/quizzes')}>
                        <FaClipboardList/> Κουίζ
                    </Link>
                    <Link to="/teacher/dashboard/analytics" className={getNavLinkClass('/teacher/dashboard/analytics')}>
                         <FaChartBar/> Στατιστικά
                    </Link>
                    <Link to="/teacher/dashboard/materials" className={getNavLinkClass('/teacher/dashboard/materials')}>
                         <FaBook/> Υλικό
                    </Link>
                </nav>

                <div className="header-user-controls">
                     {user && <span className="user-email" title={user.email}>{user.email}</span>}
                    <button onClick={logout} className="logout-button" title="Αποσύνδεση">
                        <FaSignOutAlt/>
                        <span>Αποσύνδεση</span>
                    </button>
                </div>
             </header>

             <main className="teacher-dashboard-content">
                 <Outlet />
             </main>
        </div>
    );
}

export default TeacherDashboard;