// frontend/src/components/Dashboard/PromptBuilder/SortableBlock.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaGripVertical, FaTrash, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { BlockTypes } from '../PromptWorkshop';
import '../../../styles/PromptWorkshop.css';

function SortableBlock({ id, block, onDeleteBlock, onUpdateBlockContent, isDragging, isOpacityReduced }) {
  const [isEditing, setIsEditing] = useState(
    block.type === BlockTypes.CUSTOM_TEXT && block.content.includes('Εισαγάγετε τη δική σας οδηγία...')
  );
  const [editedContent, setEditedContent] = useState(block.content);
  const textareaRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id });

  const currentlyDragging = isDragging || isSortableDragging;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isOpacityReduced ? 0.5 : 1,
    cursor: currentlyDragging ? 'grabbing' : 'grab',
    zIndex: currentlyDragging ? 10 : 'auto'
  };

  const handleEditClick = () => {
    setEditedContent(block.content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() !== block.content) {
      onUpdateBlockContent(id, editedContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(block.content);
    setIsEditing(false);
  };

  const handleContentChange = (e) => {
    setEditedContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const getBlockIcon = () => {
    switch (block.type) {
      case BlockTypes.MATERIAL_SUMMARY:
        return <span title="Περίληψη Υλικού" aria-hidden="true">📄</span>;
      case BlockTypes.CUSTOM_TEXT:
        return <span title="Προσαρμοσμένο Κείμενο" aria-hidden="true">✏️</span>;
      case BlockTypes.PALETTE_ITEM:
      case BlockTypes.CANVAS_BLOCK:
        if (block.title?.includes('Ρόλος') || block.title?.includes('Προσωπικότητα')) return <span title={block.title} aria-hidden="true">🎯</span>;
        if (block.title?.includes('Ύφος')) return <span title={block.title} aria-hidden="true">🗣️</span>;
        if (block.title?.includes('Πλαίσιο') || block.title?.includes('Γνώση')) return <span title={block.title} aria-hidden="true">📚</span>;
        if (block.title?.includes('Καθοδήγηση') || block.title?.includes('Βήμα')) return <span title={block.title} aria-hidden="true">❓</span>;
        if (block.title?.includes('Παράδειγμα')) return <span title={block.title} aria-hidden="true">✅</span>;
        if (block.title?.includes('Ασφάλεια')) return <span title={block.title} aria-hidden="true">🛡️</span>;
        return <span title="Οδηγία" aria-hidden="true">⚙️</span>;
      default:
        return <span title="Μπλοκ" aria-hidden="true">🧱</span>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`canvas-block ${currentlyDragging ? 'dragging' : ''} type-${block.type || 'default'}`}
      role="listitem"
      aria-roledescription="Draggable block"
    >
      <div className="drag-handle-visual subtle-button" title="Σύρετε για αναδιάταξη" aria-label="Drag to reorder">
        <FaGripVertical />
      </div>

      <div className="block-content-area">
        <div className="block-header">
          {getBlockIcon()}
          <strong>{block.title || 'Μπλοκ Οδηγίας'}</strong>
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={handleContentChange}
            onBlur={handleSaveEdit}
            rows={3}
            className="block-textarea"
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Edit block content"
          />
        ) : (
          <p
            className="block-text"
            onDoubleClick={block.type === BlockTypes.CUSTOM_TEXT ? handleEditClick : undefined}
            aria-label="Block content"
          >
            {block.content}
            {block.type === BlockTypes.CUSTOM_TEXT && (
              <FaEdit className="edit-hint-icon" title="Διπλό κλικ για επεξεργασία" aria-hidden="true" />
            )}
          </p>
        )}
      </div>

      <div className="block-actions" onMouseDown={(e) => e.stopPropagation()} aria-label="Block actions">
        {isEditing ? (
          <>
            <button onClick={handleSaveEdit} className="action-button save subtle-button" title="Αποθήκευση αλλαγών" aria-label="Save">
              <FaCheck />
            </button>
            <button onClick={handleCancelEdit} className="action-button cancel subtle-button" title="Ακύρωση επεξεργασίας" aria-label="Cancel">
              <FaTimes />
            </button>
          </>
        ) : (
          <>
            {block.type === BlockTypes.CUSTOM_TEXT && (
              <button onClick={handleEditClick} className="action-button edit subtle-button" title="Επεξεργασία περιεχομένου" aria-label="Edit">
                <FaEdit />
              </button>
            )}
            <button onClick={() => onDeleteBlock(id)} className="action-button delete subtle-button" title="Διαγραφή μπλοκ" aria-label="Delete">
              <FaTrash />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default SortableBlock;
