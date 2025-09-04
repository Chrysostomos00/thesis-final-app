import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaGripVertical, FaTrash, FaEdit, FaSave, FaTimes, FaPlus, FaCheckSquare, FaRegSquare, FaCheck } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import '../../../styles/QuizComponents.css';

function QuestionEditor({ questionData, index, onUpdate, onDelete, isEditing, onToggleEdit, activeId }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging
    } = useSortable({ id: questionData.tempId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 100 : 'auto', // Bring dragged item to front
    };

    // Local state for editing within this component
    const [localQuestionText, setLocalQuestionText] = useState(questionData.question_text);
    const [localChoices, setLocalChoices] = useState(() =>
         // Initialize local choices with temporary IDs if they don't have them
         questionData.choices.map(c => ({ ...c, tempId: c.tempId || uuidv4() }))
    );
    const [originalState, setOriginalState] = useState(null); // To store state before editing
    const questionTextRef = useRef(null);

    // Store original state when editing starts
    useEffect(() => {
        if (isEditing && !originalState) {
            setOriginalState({
                text: questionData.question_text,
                choices: questionData.choices.map(c => ({ ...c, tempId: c.tempId || uuidv4() }))
            });
            setLocalQuestionText(questionData.question_text);
            setLocalChoices(questionData.choices.map(c => ({ ...c, tempId: c.tempId || uuidv4() })));
             // Auto-focus the question text area
             setTimeout(() => questionTextRef.current?.focus(), 0);

        } else if (!isEditing && originalState) {
            // Clear original state when exiting edit mode (saved or cancelled)
            setOriginalState(null);
        }
        // Only run when isEditing changes
    }, [isEditing, questionData.question_text, questionData.choices, originalState]);


    const handleChoiceTextChange = (choiceTempId, newText) => {
        setLocalChoices(prev => prev.map(c =>
            c.tempId === choiceTempId ? { ...c, choice_text: newText } : c
        ));
    };

    const handleCorrectToggle = (choiceTempId) => {
         // For MCQ, ensure only one is correct
        setLocalChoices(prev => prev.map(c => ({
             ...c,
             is_correct: c.tempId === choiceTempId // Set clicked one to true, others to false
         })));
    };

     const handleAddChoice = () => {
        setLocalChoices(prev => [
            ...prev,
            { tempId: uuidv4(), choice_text: '', is_correct: false } // New choice is incorrect by default
        ]);
    };

    const handleDeleteChoice = (choiceTempId) => {
         // Prevent deleting the last choice or the only correct choice
        if (localChoices.length <= 1) return; // Need at least one choice
        const choiceToDelete = localChoices.find(c => c.tempId === choiceTempId);
        if (choiceToDelete?.is_correct && localChoices.filter(c => c.is_correct).length <= 1) return; // Don't delete the only correct one

        setLocalChoices(prev => prev.filter(c => c.tempId !== choiceTempId));
    };

    const handleSaveChanges = () => {
         // Basic validation within the editor before passing up
         if (!localQuestionText.trim()) {
             alert("Question text cannot be empty.");
             return;
         }
         if (questionData.question_type === 'mcq') {
              if (localChoices.length < 2) {
                  alert("Multiple choice questions need at least 2 options.");
                  return;
              }
              if (localChoices.some(c => !c.choice_text.trim())) {
                  alert("All answer choices must have text.");
                  return;
              }
              if (localChoices.filter(c => c.is_correct).length !== 1) {
                   alert("Multiple choice questions must have exactly one correct answer selected.");
                   return;
              }
         }

        onUpdate({
            question_text: localQuestionText,
            choices: localChoices.map(({ tempId, ...rest }) => rest), // Remove tempId before saving
            // Keep other fields like question_type, order_index as they were (handled in parent if needed)
        });
        // onToggleEdit(); // Parent will handle setting isEditing to false
    };

    const handleCancelEdit = () => {
        // Restore from original state captured when editing started
        if (originalState) {
             setLocalQuestionText(originalState.text);
             setLocalChoices(originalState.choices);
        }
        onToggleEdit(); // Exit edit mode
    };

    return (
        <div ref={setNodeRef} style={style} className={`quiz-question-editor ${isEditing ? 'editing' : ''} ${isDragging ? 'dragging' : ''}`}>
            {/* Drag Handle */}
             <span {...attributes} {...listeners} className="drag-handle" title="Drag to reorder question">
                <FaGripVertical />
            </span>

            <div className="question-content">
                <div className="question-header">
                    <span>Q{index + 1}</span>
                    {/* Display Type (could be dropdown if editing) */}
                    <span className='question-type-badge'>{questionData.question_type.toUpperCase()}</span>
                </div>

                {isEditing ? (
                    <>
                        {/* Question Text Area */}
                         <textarea
                            ref={questionTextRef}
                            value={localQuestionText}
                            onChange={(e) => setLocalQuestionText(e.target.value)}
                            placeholder="Enter question text..."
                            rows={3}
                            className='question-text-input'
                         />
                         {/* Choices Editor (for MCQ) */}
                         {questionData.question_type === 'mcq' && (
                            <div className="choices-editor">
                                <label>Answer Choices (Mark correct with <FaCheckSquare/>):</label>
                                {localChoices.map((choice, choiceIndex) => (
                                    <div key={choice.tempId} className='choice-edit-row'>
                                        <button
                                            type="button"
                                            onClick={() => handleCorrectToggle(choice.tempId)}
                                            className={`correct-toggle-btn subtle-button ${choice.is_correct ? 'correct' : ''}`}
                                            title={choice.is_correct ? "Mark as incorrect" : "Mark as correct"}
                                        >
                                            {choice.is_correct ? <FaCheckSquare /> : <FaRegSquare />}
                                        </button>
                                         <input
                                             type="text"
                                             value={choice.choice_text}
                                             onChange={(e) => handleChoiceTextChange(choice.tempId, e.target.value)}
                                             placeholder={`Choice ${choiceIndex + 1}`}
                                             className='choice-text-input'
                                         />
                                         <button
                                             type="button"
                                             onClick={() => handleDeleteChoice(choice.tempId)}
                                             className='delete-choice-btn subtle-button'
                                             disabled={localChoices.length <= 1 || (choice.is_correct && localChoices.filter(c => c.is_correct).length <= 1)} // Prevent deleting last/only correct
                                             title="Delete choice"
                                         >
                                             <FaTimes />
                                         </button>
                                     </div>
                                ))}
                                <button type="button" onClick={handleAddChoice} className='add-choice-btn subtle-button'>
                                     <FaPlus /> Add Choice
                                 </button>
                             </div>
                         )}
                         {/* Add editors for other question types here later */}
                     </>
                 ) : (
                     <>
                         {/* Display Question Text */}
                         <p className='question-text-display'>{questionData.question_text}</p>
                         {/* Display Choices (for MCQ) */}
                          {questionData.question_type === 'mcq' && (
                            <ul className="choices-display">
                                {questionData.choices.map((choice) => (
                                     <li key={choice.tempId || choice.id} className={choice.is_correct ? 'correct-answer' : ''}>
                                         {choice.choice_text} {choice.is_correct && <FaCheck title="Correct Answer"/>}
                                     </li>
                                 ))}
                             </ul>
                         )}
                     </>
                 )}
             </div>

             {/* Action Buttons */}
             <div className="question-actions">
                 {isEditing ? (
                     <>
                         <button onClick={handleSaveChanges} className="action-button save" title="Save Changes"> <FaSave /> Save</button>
                         <button onClick={handleCancelEdit} className="action-button cancel subtle-button" title="Cancel Edit"> <FaTimes /> Cancel</button>
                     </>
                 ) : (
                     <>
                         <button onClick={onToggleEdit} className="action-button edit subtle-button" title="Edit Question"> <FaEdit /></button>
                         <button onClick={onDelete} className="action-button delete subtle-button" title="Delete Question"> <FaTrash /></button>
                     </>
                 )}
             </div>
        </div>
    );
}

export default QuestionEditor;