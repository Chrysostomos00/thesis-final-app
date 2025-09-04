import React, { useState } from 'react';
// --- Import getPromptDetails ---
import { deletePrompt, updatePrompt, getPromptDetails } from '../../services/api';
import {
    FaListAlt,
    FaTrash,
    FaSpinner,
    FaEye,
    FaEyeSlash,
    FaCheckCircle,
    FaCheck
} from 'react-icons/fa';
import '../../styles/SavedPrompts.css';

function SavedPrompts({
    prompts,
    onLoadPrompt,
    refreshPrompts,
    currentPromptId,
    isLoading,
    showError,
    showSuccess,
    clearMessages
}) {
    const [isDeleting, setIsDeleting] = useState(null);
    const [updatingVisibility, setUpdatingVisibility] = useState(null);

    const handleDelete = async (e, promptId, promptName) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete the prompt "${promptName}"? This cannot be undone.`)) {
            return;
        }
        clearMessages();
        setIsDeleting(promptId);
        try {
            await deletePrompt(promptId);
            showSuccess(`Prompt "${promptName}" deleted successfully.`);
            if (refreshPrompts) { refreshPrompts(); }
        } catch (error) {
            console.error('Delete prompt failed:', error);
            showError(error.response?.data?.error || 'Failed to delete prompt.');
            if (isDeleting === promptId) setIsDeleting(null); // Ensure state clears on error
        } finally {
            if (isDeleting === promptId) setIsDeleting(null); // Ensure state clears
        }
    };

     // --- Modified handleToggleVisibility ---
     const handleToggleVisibility = async (e, prompt) => {
        e.stopPropagation();
        if (updatingVisibility || !prompt || !prompt.id) return;

        const newVisibility = !prompt.is_public;
        setUpdatingVisibility(prompt.id);
        clearMessages();

        try {
            // 1. Fetch the full prompt details first to get the structure
            console.log(`Fetching details for prompt ID: ${prompt.id} before toggling visibility.`);
            const detailsResponse = await getPromptDetails(prompt.id);
            const fullPromptData = detailsResponse.data;

            // Check if structure exists
            if (!Array.isArray(fullPromptData.structure)) {
                console.error("Fetched prompt details missing valid structure array.");
                showError("Failed to update visibility: Prompt data incomplete.");
                setUpdatingVisibility(null);
                return;
            }

            // 2. Prepare the complete update payload
            const updateData = {
                name: fullPromptData.name, // Use fetched name
                description: fullPromptData.description || '', // Use fetched description
                structure: fullPromptData.structure, // Use fetched structure
                is_public: newVisibility // The only changed value
            };

            console.log(`Sending update payload for prompt ${prompt.id}:`, updateData); // Log payload before sending

            // 3. Send the update request with the full data
            await updatePrompt(prompt.id, updateData);

            showSuccess(`Prompt "${fullPromptData.name}" visibility updated to ${newVisibility ? 'Public' : 'Private'}.`);

            // 4. Refresh the list to show the updated status visually
            if (refreshPrompts) {
                refreshPrompts();
            }
        } catch (error) {
            console.error("Failed to update visibility:", error);
            showError(error.response?.data?.error || "Failed to update visibility.");
        } finally {
            setUpdatingVisibility(null);
        }
    };
    // --- End Modified handleToggleVisibility ---


    const formatDate = (dateString) => {
        // ... (formatDate function remains the same) ...
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
        } catch (e) { return dateString; }
    };

    return (
        <div className="widget saved-prompts">
            <h3><FaListAlt /> Saved Prompts</h3>
            <div className="prompt-list-container">
                {isLoading ? (
                    <div className="loading-prompts"><FaSpinner className="spin" /> Loading prompts...</div>
                ) : prompts && prompts.length > 0 ? (
                    <ul className="prompt-list">
                        {prompts.map((prompt) => ( // Use the 'prompt' object passed in map
                            <li
                                key={prompt.id}
                                className={`prompt-item ${isDeleting === prompt.id ? 'deleting' : ''} ${currentPromptId === prompt.id ? 'selected' : ''}`}
                                onClick={() => onLoadPrompt(prompt)}
                                title={`Click to load prompt.\nDescription: ${prompt.description || 'N/A'}\nLast updated: ${formatDate(prompt.updated_at)}`}
                            >
                                {currentPromptId === prompt.id && <FaCheckCircle className="selected-indicator" title="Currently loaded"/>}
                                <div className="prompt-info">
                                    <span className="prompt-name">{prompt.name}</span>
                                    {prompt.description && (
                                       <p className="prompt-description-preview">{prompt.description}</p>
                                    )}
                                    <span className="prompt-date">Updated: {formatDate(prompt.updated_at)}</span>
                                    <div className="prompt-visibility">
                                        {updatingVisibility === prompt.id ? (
                                            <FaSpinner className="spin" />
                                        ) : (
                                            <span
                                                className={`visibility-toggle ${prompt.is_public ? 'public' : 'private'}`}
                                                onClick={(e) => handleToggleVisibility(e, prompt)} // Pass the prompt object
                                                title={`Click to make ${prompt.is_public ? 'Private' : 'Public'}`}
                                            >
                                                {prompt.is_public ? <FaEye className="public-status" /> : <FaEyeSlash className="private-status" />}
                                                <span className={prompt.is_public ? 'public-status' : 'private-status'}>
                                                    {prompt.is_public ? ' Public' : ' Private'}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="delete-button subtle-button"
                                    onClick={(e) => handleDelete(e, prompt.id, prompt.name)}
                                    disabled={isDeleting === prompt.id || updatingVisibility === prompt.id}
                                    title="Delete prompt"
                                >
                                    {isDeleting === prompt.id ? <FaSpinner className="spin" /> : <FaTrash />}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="empty-list-message">No prompts saved yet.</p>
                )}
            </div>
        </div>
    );
}

export default SavedPrompts;