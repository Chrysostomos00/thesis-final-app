// frontend/src/components/Dashboard/PromptBuilder/PromptBuilder.jsx
import React from 'react';
import SortableBlock from './SortableBlock';
import { FaPlus } from 'react-icons/fa';

function PromptBuilder({ blocks, onDeleteBlock, onUpdateBlockContent, activeId }) {
  return (
    <div className="prompt-builder-canvas" role="list" aria-label="Prompt canvas blocks">
      {blocks && blocks.length > 0 ? (
        blocks.map((block) => (
          <SortableBlock
            key={block.id}
            id={block.id}
            block={block}
            onDeleteBlock={onDeleteBlock}
            onUpdateBlockContent={onUpdateBlockContent}
            isOpacityReduced={activeId === block.id}
          />
        ))
      ) : (
        <div className="empty-canvas-message" aria-live="polite">
          <FaPlus />
          <p>Τραβήξτε ή πατήστε την εντολή απο τα αριστερά για να ξεκινήσετε να εκπαιδεύεται το βοηθό σας!</p>
        </div>
      )}
    </div>
  );
}

export default PromptBuilder;
