// frontend/src/components/Dashboard/PromptListForModal.js
import React from 'react';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
// Path for shared styles (assuming PromptWorkshop.css or SavedPrompts.css has relevant styles)
import '../../styles/SavedPrompts.css'; // Contains .prompt-list styles
import '../../styles/Modal.css'; // For modal specific overrides if any

function PromptListForModal({ prompts, onLoadPrompt, isLoading, currentPromptId, showError }) { // Added showError
    if (isLoading) {
        return (
            <div className="loading-items" style={{minHeight: '200px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <FaSpinner className="spin" /> Φόρτωση αποθηκευμένων βοηθών...
            </div>
        );
    }

    if (!prompts || prompts.length === 0) {
        return (
             <div className="empty-list-message" style={{ margin: '1rem 0' }}>
                <p>Δεν έχεις φτιάξει ακόμα κάποιο βοηθό.</p>
             </div>
        );
    }

    const formatDate = (dateString) => {
         if (!dateString) return 'N/A';
         try { return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
         catch (e) { return dateString; }
    };

    return (
        <div className="prompt-list-modal-content">
            <p style={{fontSize: '0.9em', color: 'var(--text-color-secondary)', marginBottom: '1rem'}}>
                Select an assistant to load its configuration into the workshop.
            </p>
            <ul className="prompt-list"> {/* Reuse existing style */}
                {prompts.map((prompt) => (
                    <li
                        key={prompt.id}
                        className={`prompt-item ${currentPromptId === prompt.id ? 'selected' : ''}`}
                        onClick={() => {
                            if (prompt.id === currentPromptId) {
                                if(showError) showError("This assistant is already loaded."); // Use showError if passed
                                else console.warn("This assistant is already loaded.");
                                return;
                            }
                            onLoadPrompt(prompt);
                        }}
                        title={`Load: ${prompt.name}\nDescription: ${prompt.description || 'N/A'}`}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="prompt-info"> {/* Style defined in SavedPrompts.css */}
                            <span className="prompt-name">{prompt.name}</span>
                            {prompt.description && <p className="prompt-description-preview">{prompt.description}</p>}
                            <span className="prompt-date">Updated: {formatDate(prompt.updated_at)}</span>
                        </div>
                        <div className="prompt-visibility-modal" style={{display: 'flex', alignItems: 'center', gap: '0.3em', fontSize: '0.85em', color: prompt.is_public ? 'var(--success-color)' : 'var(--text-color-muted)'}}>
                             {prompt.is_public ? <FaEye /> : <FaEyeSlash />}
                             <span>{prompt.is_public ? 'Public' : 'Private'}</span>
                        </div>
                        {/* No edit/delete/toggle actions in modal context */}
                    </li>
                ))}
            </ul>
        </div>
    );
}
export default PromptListForModal;