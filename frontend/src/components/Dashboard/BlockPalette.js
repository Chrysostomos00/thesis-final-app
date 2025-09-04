// frontend/src/components/Dashboard/BlockPalette.jsx
import React, { useState } from 'react';
import { FaPlusCircle, FaEdit, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import '../../styles/PromptWorkshop.css';

function BlockPalette({ blocksByCategory, onAddBlock, onAddCustom }) {
  const [openCategories, setOpenCategories] = useState({});

  const toggleCategory = (categoryName) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  if (!blocksByCategory || Object.keys(blocksByCategory).length === 0) {
    return (
      <div className="widget block-palette">
        <h3><FaPlusCircle /> Block Library</h3>
        <p className="palette-instruction empty-list-message" style={{ textAlign: 'left', border: 'none', padding: '0' }}>
          No pre-made blocks available.
        </p>
        <button onClick={onAddCustom} className="add-custom-button button secondary-button">
          <FaEdit /> Add Custom Instruction
        </button>
      </div>
    );
  }

  return (
    <div className="widget block-palette" aria-label="Block Library">
      <h3><FaPlusCircle /> Block Library</h3>
      <p className="palette-instruction"> Επέλεγξε μια κατηγορία και σήρε ή πάτησε και να το προσθέσεις στο κανβά σου!</p>

      {Object.entries(blocksByCategory).map(([categoryName, blocks]) => (
        <div key={categoryName} className="palette-category">
          <button
            type="button"
            className="palette-category-title subtle-button"
            onClick={() => toggleCategory(categoryName)}
            aria-expanded={!!openCategories[categoryName]}
            aria-controls={`category-blocks-${categoryName.replace(/\s+/g, '-')}`}
            title={`Toggle ${categoryName} blocks`}
          >
            {openCategories[categoryName] ? (
              <FaChevronDown size="0.9em" style={{ marginRight: '0.4em' }} />
            ) : (
              <FaChevronRight size="0.9em" style={{ marginRight: '0.4em' }} />
            )}
            <span>{categoryName}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8em', color: 'var(--text-color-muted)' }}>
              ({blocks.length})
            </span>
          </button>

          {openCategories[categoryName] && (
            <div className="palette-grid" id={`category-blocks-${categoryName.replace(/\s+/g, '-')}`}>
              {blocks.map((block) => {
                const titleParts = block.title.split(' ');
                const iconEmoji = titleParts[0].length <= 2 && /\p{Emoji}/u.test(titleParts[0]) ? titleParts[0] : null;
                const textTitle = iconEmoji ? titleParts.slice(1).join(' ') : block.title;

                return (
                  <div
                    key={block.id}
                    className="palette-block"
                    title={block.content}
                    onClick={() => onAddBlock(block)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && onAddBlock(block)}
                    aria-label={`Add “${textTitle}”`}
                  >
                    {iconEmoji && (
                      <span aria-hidden="true" style={{ marginRight: '0.5em', fontSize: '1.1em' }}>
                        {iconEmoji}
                      </span>
                    )}
                    <strong>{textTitle}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <button onClick={onAddCustom} className="add-custom-button button secondary-button">
        <FaEdit /> Add Custom Instruction
      </button>
    </div>
  );
}

export default BlockPalette;
