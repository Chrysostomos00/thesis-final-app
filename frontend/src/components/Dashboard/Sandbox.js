// frontend/src/components/Dashboard/Sandbox.jsx
import React, { useState, useEffect } from 'react';
import { generateTestResponse } from '../../services/api';
import { FaPaperPlane, FaSpinner, FaVial, FaLightbulb, FaBroom } from 'react-icons/fa';
import '../../styles/TeacherDashboard.css';
import '../../styles/Sandbox.css';

function Sandbox({
  currentPromptStructure,
  promptIdToUseIfNoStructure,
  showError,
  showSuccess,
  clearMessages
}) {
  const [userTestPrompt, setUserTestPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usageInfo, setUsageInfo] = useState(null);
  const [previewSystemPrompt, setPreviewSystemPrompt] = useState('');

  useEffect(() => {
    let displayPrompt = '(No prompt instructions defined yet. Add blocks to the canvas or load an assistant.)';
    if (currentPromptStructure && currentPromptStructure.length > 0) {
      displayPrompt = currentPromptStructure.map(block => {
        if (block.isMaterialBlock && block.materialName) {
          return `[CONTEXT FROM: ${block.materialName} - Full text will be used by AI]`;
        }
        return block.content;
      }).join("\n\n");
    } else if (promptIdToUseIfNoStructure) {
      displayPrompt = `(Testing saved assistant [ID: ${promptIdToUseIfNoStructure}]. The AI will use its saved instructions.)`;
    }
    setPreviewSystemPrompt(displayPrompt);
  }, [currentPromptStructure, promptIdToUseIfNoStructure]);

  const handleTestPrompt = async () => {
    if (clearMessages) clearMessages();

    if (!userTestPrompt.trim()) {
      if (showError) showError("Please enter a question or phrase in the sandbox to test.");
      return;
    }
    if ((!currentPromptStructure || currentPromptStructure.length === 0) && !promptIdToUseIfNoStructure) {
      if (showError) showError("Please add blocks to the canvas or load a saved assistant before testing.");
      return;
    }

    setIsLoading(true);
    setAiResponse('');
    setUsageInfo(null);

    const payload = {
      user_prompt: userTestPrompt,
      prompt_structure: currentPromptStructure,
      prompt_id: promptIdToUseIfNoStructure
    };

    try {
      const response = await generateTestResponse(payload);
      setAiResponse(response.data.response);
      setUsageInfo(response.data.usage);
      if (showSuccess) showSuccess("AI response received successfully.");
    } catch (error) {
      console.error('Sandbox generation error:', error);
      const errMsg = error.response?.data?.error || 'An error occurred while generating the response in the sandbox.';
      if (showError) showError(errMsg);
      setAiResponse(`Error: ${errMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSandbox = () => {
    setUserTestPrompt('');
    setAiResponse('');
    setUsageInfo(null);
    if (clearMessages) clearMessages();
  };

  return (
    <div className="widget sandbox">
      <h3><FaVial /> Test Sandbox</h3>
      <p className="sandbox-instruction">
        <FaLightbulb /> Test your AI Assistant based on the current instructions in the canvas or the loaded assistant.
      </p>

      <div className="sandbox-system-preview" aria-live="polite">
        <strong>Preview of Instructions (Backend will process fully):</strong>
        <pre>{previewSystemPrompt}</pre>
      </div>

      <div className="sandbox-input-area">
        <textarea
          value={userTestPrompt}
          onChange={(e) => setUserTestPrompt(e.target.value)}
          placeholder="Enter a student's question or phrase here..."
          rows={4}
          disabled={isLoading}
          aria-label="Enter a test question"
        />
        <div className="sandbox-actions">
          <button onClick={clearSandbox} className="button subtle-button" disabled={isLoading} title="Clear sandbox inputs and response">
            <FaBroom /> Clear
          </button>
          <button
            onClick={handleTestPrompt}
            className="button primary-button"
            disabled={isLoading || !userTestPrompt.trim() || previewSystemPrompt.startsWith('(No prompt')}
          >
            {isLoading ? <><FaSpinner className="spin" /> Testing...</> : <><FaPaperPlane /> Test Prompt</>}
          </button>
        </div>
      </div>

      <div className="sandbox-output-area">
        <strong>AI Response:</strong>
        {isLoading && <div className="loading-indicator-sandbox"><FaSpinner className="spin" /> Thinking...</div>}
        {aiResponse && !isLoading && <pre className="ai-response-text">{aiResponse}</pre>}
        {!aiResponse && !isLoading && <p className="empty-list-message" style={{ padding: '1rem', fontSize: '0.9em' }}>(AI's response will appear here)</p>}
        {usageInfo && (
          <p className="usage-info">
            (Tokens Used: Prompt={usageInfo.prompt_tokens}, Completion={usageInfo.completion_tokens}, Total={usageInfo.total_tokens})
          </p>
        )}
      </div>
    </div>
  );
}

export default Sandbox;
