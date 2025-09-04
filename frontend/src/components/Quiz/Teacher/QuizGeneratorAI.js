import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { generateQuizQuestionsAI, getMaterials } from '../../../services/api';
import { FaMagic, FaSpinner } from 'react-icons/fa'; // Removed FaBook as it was unused
import '../../../styles/QuizComponents.css'; // Ensure this path is correct for your CSS

function QuizGeneratorAI({ onQuestionsGenerated, showLoading, hideLoading, showError }) {
    const [contextType, setContextType] = useState('material');
    const [selectedMaterialId, setSelectedMaterialId] = useState('');
    const [customContext, setCustomContext] = useState('');
    const [numQuestions, setNumQuestions] = useState(5); // Default number of questions
    const [difficulty, setDifficulty] = useState('medium'); // Default difficulty
    const [materials, setMaterials] = useState([]);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Using useCallback for showError if passed down from parent that uses it in dependency array
    const stableShowError = useCallback(showError, [showError]);

    useEffect(() => {
        if (contextType === 'material') {
            setIsLoadingMaterials(true);
            getMaterials()
                .then(response => setMaterials(response.data || []))
                .catch(err => {
                    console.error("Error fetching materials for quiz generator:", err);
                    stableShowError("Could not load materials list.");
                    setMaterials([]);
                })
                .finally(() => setIsLoadingMaterials(false));
        }
    }, [contextType, stableShowError]);

    const handleGenerate = async () => {
        let contextPayload = {};

        if (contextType === 'text') {
            if (!customContext.trim()) {
                stableShowError("Please enter some context text for AI generation.");
                return;
            }
            contextPayload = { context_text: customContext };
        } else { // contextType === 'material'
            if (!selectedMaterialId) {
                stableShowError("Please select a material for AI generation.");
                return;
            }
            // No need to send material summary from here, backend handles full text via ID
            contextPayload = { material_id: selectedMaterialId };
        }

        setIsGenerating(true);
        if (showLoading) showLoading("Generating questions with AI...");

        const fullPayload = {
            ...contextPayload, // material_id OR context_text
            num_questions: numQuestions,
            difficulty: difficulty, // Add difficulty to payload
            question_types: ["mcq"] // You can make this dynamic later if needed
        };

        console.log("QuizGeneratorAI: Sending this payload to API:", fullPayload);

        try {
            // Pass the single 'fullPayload' object
            const response = await generateQuizQuestionsAI(fullPayload);
            console.log("AI Generated Questions API Response:", response);
            if (response && response.data) {
                onQuestionsGenerated(response.data);
            } else {
                throw new Error("AI response was empty or malformed.");
            }
        } catch (error) {
            console.error("AI Quiz Generation failed:", error);
            const errorMsg = error.response?.data?.error || error.message || "AI failed to generate questions. Please check context or try again.";
            stableShowError(errorMsg);
            onQuestionsGenerated([]); // Pass empty array on failure
        } finally {
            setIsGenerating(false);
            if (hideLoading) hideLoading();
        }
    };

    return (
        <div className="quiz-generator-ai widget-section">
            <h4><FaMagic /> Generate Questions with AI</h4>
            <div className="generator-options">
                <div className="form-group">
                    <label htmlFor="quiz-gen-context-type">Context Source:</label>
                    <select id="quiz-gen-context-type" value={contextType} onChange={(e) => setContextType(e.target.value)} disabled={isGenerating}>
                        <option value="material">From Uploaded Material</option>
                        <option value="text">From Custom Text</option>
                    </select>
                </div>

                {contextType === 'material' && (
                    <div className="form-group">
                        <label htmlFor="quiz-gen-material-select">Select Material:</label>
                        {isLoadingMaterials ? (
                            <p><FaSpinner className="spin"/> Loading materials...</p>
                        ) : (
                            <select
                                id="quiz-gen-material-select"
                                value={selectedMaterialId}
                                onChange={(e) => setSelectedMaterialId(e.target.value)}
                                disabled={isGenerating || materials.length === 0}
                            >
                                <option value="">-- Select Material --</option>
                                {materials.map(material => (
                                    <option key={material.id} value={material.id}>
                                        {material.name}
                                    </option>
                                ))}
                            </select>
                        )}
                         {materials.length === 0 && !isLoadingMaterials && <p className='hint-text'>No materials uploaded. Upload via "Manage Materials".</p>}
                    </div>
                )}

                {contextType === 'text' && (
                    <div className="form-group">
                        <label htmlFor="quiz-gen-custom-context">Enter Context Text (for AI):</label>
                        <textarea
                            id="quiz-gen-custom-context"
                            rows="5"
                            value={customContext}
                            onChange={(e) => setCustomContext(e.target.value)}
                            placeholder="Paste or type the text the AI should use to create questions..."
                            disabled={isGenerating}
                        />
                    </div>
                )}

                <div className="form-group inline-group">
                    <label htmlFor="quiz-gen-num-questions">Number of Questions (1-15):</label>
                    <input
                        type="number"
                        id="quiz-gen-num-questions"
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))}
                        min="1"
                        max="15" // Max as defined in backend
                        disabled={isGenerating}
                    />
                </div>
                <div className="form-group inline-group">
                     <label htmlFor="quiz-gen-difficulty">Difficulty:</label>
                     <select id="quiz-gen-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={isGenerating}>
                         <option value="easy">Easy</option>
                         <option value="medium">Medium</option>
                         <option value="hard">Hard</option>
                     </select>
                 </div>

                <button onClick={handleGenerate} className="button primary-button" disabled={isGenerating || (contextType === 'material' && !selectedMaterialId) || (contextType==='text' && !customContext.trim())}>
                    {isGenerating ? <><FaSpinner className="spin" /> Generating...</> : <><FaMagic /> Generate AI Questions</>}
                </button>
            </div>
        </div>
    );
}

export default QuizGeneratorAI;