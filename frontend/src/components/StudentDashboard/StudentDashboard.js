import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FaSignOutAlt, FaComments, FaClipboardList, FaGraduationCap } from 'react-icons/fa';
import AssistantViewStudent from './AssistantViewStudent';
import QuizListStudent from '../Quiz/Student/QuizListStudent';
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import '../../styles/StudentDashboard.css';

function StudentDashboard() {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState('assistants');
  const [userAvatarSvg, setUserAvatarSvg] = useState('');

  useEffect(() => {
    if (user?.email) {
      const avatar = createAvatar(adventurer, { seed: user.email, size: 36, radius: 50 });
      setUserAvatarSvg(avatar.toString());
    }
  }, [user]);

  const navigateToView = (view) => { setActiveView(view); };

  return (
    <div className="student-dashboard-layout">
      <aside className="student-sidebar">
        <div className="sidebar-header">
          <FaGraduationCap className="logo-icon" />
          <h1>Πύλη Μαθητή</h1>
        </div>

        <nav className="student-main-nav">
          <button
            className={`student-nav-link ${activeView === 'assistants' ? 'active' : ''}`}
            onClick={() => navigateToView('assistants')}
          >
            <FaComments />
            <span>Ψηφιακοί Βοηθοί</span>
          </button>

          <button
            className={`student-nav-link ${activeView === 'quizzes' ? 'active' : ''}`}
            onClick={() => navigateToView('quizzes')}
          >
            <FaClipboardList />
            <span>Κουίζ</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-info">
              <div
                className="avatar round size-40"
                dangerouslySetInnerHTML={{ __html: userAvatarSvg || '' }}
              />
              <div className='user-details'>
                <span>{user.email}</span>
                <span title={user.id}>Student Account</span>
              </div>
            </div>
          )}
          <button onClick={logout} className="logout-button" title="Logout">
            <FaSignOutAlt />
            <span>Αποσύνδεση</span>
          </button>
        </div>
      </aside>

      <div className="student-main-content-wrapper">
        {/* Sticky header for mobile/tablet */}
        <header className="student-header">
          <div className="header-placeholder" />
          <div className="header-controls">
            {user && (
              <>
                <span className="user-pill">
                  <span
                    className="avatar round size-28"
                    dangerouslySetInnerHTML={{ __html: userAvatarSvg || '' }}
                  />
                  {user.email}
                </span>
              </>
            )}
          </div>
        </header>

        <main className="student-main-content-area">
          <div className="student-content-display">
            {activeView === 'assistants' && <AssistantViewStudent />}
            {activeView === 'quizzes' && <QuizListStudent />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default StudentDashboard;
