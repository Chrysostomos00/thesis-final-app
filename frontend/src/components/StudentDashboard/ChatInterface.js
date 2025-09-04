import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { askAssistant } from '../../services/api';
import { FaPaperPlane, FaSpinner, FaArrowLeft } from 'react-icons/fa';
import { createAvatar } from '@dicebear/core';
import { adventurer, bottts } from '@dicebear/collection';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/StudentDashboard.css';

const SUGGESTIONS = [
  "Explain this like I'm 12",
  "Give me a quick summary",
  "Show me a step-by-step",
  "Make a practice question",
  "What are common mistakes?",
];

const UserAvatar = () => {
  const { user } = useAuth();
  const svg = useMemo(() => {
    if (!user?.email) return '';
    return createAvatar(adventurer, { seed: user.email, size: 36, radius: 50 }).toString();
  }, [user]);
  return (
    <div className="message-avatar-container user-avatar">
      <div className="avatar round size-36" dangerouslySetInnerHTML={{ __html: svg }} title="You" />
    </div>
  );
};

const AssistantAvatar = ({ svgString }) => (
  <div className="message-avatar-container assistant-avatar">
    <div className="avatar square size-36" dangerouslySetInnerHTML={{ __html: svgString }} title="AI Assistant" />
  </div>
);

function ChatInterface({ promptId, promptName, promptDescription, assistantAvatarSvg, onBack }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages or loading changes
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  // Reset chat when assistant changes
  useEffect(() => {
    setMessages([]);
    setError('');
    setInputMessage('');
    setIsLoading(false);
  }, [promptId]);

  // Generate / use assistant avatar
  const defaultAssistantAvatar = useMemo(
    () => assistantAvatarSvg || createAvatar(bottts, { seed: promptId, size: 48 }).toString(),
    [assistantAvatarSvg, promptId]
  );

  const handleSendMessage = useCallback(async (messageContent) => {
    const content = (messageContent ?? inputMessage).trim();
    if (!content || isLoading) return;

    setError('');
    const newUserMessage = { role: 'user', content };
    setMessages(prev => [...prev, newUserMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await askAssistant(promptId, content);
      const assistantMessage = { role: 'assistant', content: response.data.response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Error asking assistant:", err);
      const errorMessage = err?.response?.data?.error || "Sorry, I couldn't get a response.";
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, promptId]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleSuggestionClick = (suggestion) => {
    setInputMessage(suggestion);
    handleSendMessage(suggestion);
  };

  // Textarea auto-resize
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 180;
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, [inputMessage]);

  // Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-interface-container">
      {/* Header */}
      <div className="chat-header">
        {onBack && (
          <button
            onClick={onBack}
            className='back-button'
            title="Back to assistants"
            aria-label="Back to assistants"
          >
            <FaArrowLeft /> <span className="hide-on-narrow">Back</span>
          </button>
        )}
        <div className='avatar square size-40' dangerouslySetInnerHTML={{ __html: defaultAssistantAvatar }}/>
        <div className="chat-header-info">
          <h3>{promptName || 'AI Assistant'}</h3>
          <p>{promptDescription || 'Ready to help!'}</p>
        </div>
      </div>

      {/* Suggestions */}
      {messages.length === 0 && !isLoading && (
        <div className="chat-suggestions">
          <p className="hint">Try one of these to get started:</p>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => handleSuggestionClick(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message-bubble ${msg.role}`}>
            {msg.role === 'user' ? <UserAvatar /> : <AssistantAvatar svgString={defaultAssistantAvatar} />}
            <div className="message-content">
              <pre>{msg.content}</pre>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message-bubble assistant loading">
            <AssistantAvatar svgString={defaultAssistantAvatar}/>
            <div className="message-content typing">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Error */}
      {error && <p className="error-message chat-error">{error}</p>}

      {/* Input */}
      <form className="chat-input-form" onSubmit={handleFormSubmit}>
        <textarea
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your question... (Shift+Enter for a new line)"
          disabled={isLoading}
          aria-label="Chat input"
          rows={1}
        />
        <button type="submit" disabled={isLoading || !inputMessage.trim()} title="Send Message" aria-label="Send">
          {isLoading ? <FaSpinner className="spin" /> : <FaPaperPlane />}
        </button>
      </form>
    </div>
  );
}

export default ChatInterface;
