import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getStudentPrompts } from '../../services/api';
import { createAvatar } from '@dicebear/core';
import { bottts } from '@dicebear/collection';
import { FaSpinner, FaComments, FaSearch, FaSortAlphaDown, FaSortAlphaUp } from 'react-icons/fa';
import ChatInterface from './ChatInterface';
import '../../styles/StudentDashboard.css';

// Local gamification counters
function useGamification() {
  const [xp, setXp] = useState(() => parseInt(localStorage.getItem('student_xp') || '0', 10));
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('student_streak') || '0', 10));
  const [lastActive, setLastActive] = useState(() => localStorage.getItem('student_last_active') || '');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastActive !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newStreak = lastActive === yesterday ? streak + 1 : 1;
      setStreak(newStreak);
      setLastActive(today);
      localStorage.setItem('student_streak', String(newStreak));
      localStorage.setItem('student_last_active', today);
    }
  }, [lastActive, streak]);

  return { xp, streak, level: Math.floor(xp / 100) + 1, levelProgress: (xp % 100) / 100 };
}

function AssistantViewStudent() {
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [availablePrompts, setAvailablePrompts] = useState([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [error, setError] = useState('');
  const [assistantAvatars, setAssistantAvatars] = useState({});
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const { xp, streak, level, levelProgress } = useGamification();

  const showError = useCallback((msg) => setError(msg), []);

  const fetchPrompts = useCallback(async () => {
    setIsLoadingPrompts(true);
    setError('');
    try {
      const response = await getStudentPrompts();
      const promptsData = response.data || [];
      if (!Array.isArray(promptsData)) throw new Error("Invalid data format");
      setAvailablePrompts(promptsData);

      const avatars = {};
      promptsData.forEach(prompt => {
        if (prompt && prompt.id) {
          avatars[prompt.id] = createAvatar(bottts, { seed: prompt.id, size: 48 }).toString();
        }
      });
      setAssistantAvatars(avatars);
    } catch (err) {
      console.error("Error fetching student prompts:", err);
      showError("Could not load available assistants. Please refresh.");
      setAvailablePrompts([]);
    } finally {
      setIsLoadingPrompts(false);
    }
  }, [showError]);

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  const filteredPrompts = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = availablePrompts;
    if (term) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term)
      );
    }
    return [...list].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  }, [availablePrompts, search, sortAsc]);

  if (selectedPrompt) {
    return (
      <ChatInterface
        promptId={selectedPrompt.id}
        promptName={selectedPrompt.name}
        promptDescription={selectedPrompt.description}
        assistantAvatarSvg={assistantAvatars[selectedPrompt.id]}
        onBack={() => setSelectedPrompt(null)}
      />
    );
  }

  return (
    <div className='assistant-view-container'>
      <div className="gamify-strip">
        <div className="gamify-card level">
          <div className="ring">
            <div className="ring-track" style={{ '--ring-progress': `${Math.round(levelProgress * 100)}%` }} />
            <div className="ring-center">
              <span>Level</span>
              <strong>{level}</strong>
            </div>
          </div>
          <div className="meta">
            <h4>Η πρόοδός σας</h4>
            <p>{100 - (xp % 100)} XP to next</p>
          </div>
        </div>

        <div className="gamify-card streak">
          <div className="big-num">{streak}</div>
          <div className="meta">
            <h4>Day Streak</h4>
            <p>Keep it going!</p>
          </div>
        </div>

        <div className="gamify-card xp">
          <div className="big-num">{xp}</div>
          <div className="meta">
            <h4>Total XP</h4>
            <p>Κέρδισε μαθαίνοντας</p>
          </div>
        </div>
      </div>

      {error && <div className="message error-message global-message">{error}</div>}

      <div className="select-assistant-view">
        <div className='page-header'>
          <h2><FaComments/> Λύσε τις απορείες σου με τους πιο κάτω βοηθούς:</h2>
        </div>

        <div className="toolbar-row">
          <div className="input-with-icon">
            <FaSearch />
            <input
              type="text"
              placeholder="Αναζήτηση Βοηθών..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search assistants"
            />
          </div>
          <button className="button subtle-button" onClick={() => setSortAsc(s => !s)} title="Toggle sort">
            {sortAsc ? <><FaSortAlphaDown/> A→Z</> : <><FaSortAlphaUp/> Z→A</>}
          </button>
        </div>

        {isLoadingPrompts ? (
          <div className='items-grid'>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="item-card skeleton">
                <div className="s-line wide" />
                <div className="s-line" />
                <div className="s-line short" />
              </div>
            ))}
          </div>
        ) : filteredPrompts.length === 0 ? (
          <p className='no-items-message'>No AI Assistants match your search.</p>
        ) : (
          <div className='items-grid'>
            {filteredPrompts.map(prompt => (
              <div
                key={prompt.id}
                className="item-card assistant-card"
                onClick={() => setSelectedPrompt(prompt)}
                title="Click to start chat"
              >
                <div className="item-card-header">
                  <div
                    className="item-card-icon avatar square size-48"
                    dangerouslySetInnerHTML={{ __html: assistantAvatars[prompt.id] || '' }}
                  />
                  <h3 className="item-card-title">{prompt.name || 'Unnamed Assistant'}</h3>
                </div>
                <p className="item-card-description">{prompt.description || 'A helpful assistant.'}</p>
                <div className='item-card-footer'>
                  <button
                    className='button primary-button'
                    onClick={(e) => { e.stopPropagation(); setSelectedPrompt(prompt); }}
                  >
                    Chat Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssistantViewStudent;
