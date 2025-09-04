import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import '../../styles/Modal.css'; // Correct path assuming Modal.css is in src/styles

function Modal({ title, children, onClose, width = '600px', showFooter = false, customFooter }) { // Added showFooter and customFooter

    // Effect to handle Escape key press for closing modal
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handleContentClick = (e) => {
        e.stopPropagation();
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal-content"
                style={{ maxWidth: width }}
                onClick={handleContentClick}
            >
                <div className="modal-header">
                    <h3>{title || 'Modal'}</h3>
                    <button onClick={onClose} className="modal-close-btn subtle-button" title="Close (Esc)">
                        <FaTimes />
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {showFooter && (
                    <div className="modal-footer">
                        {customFooter ? customFooter : (
                            <button onClick={onClose} className='button subtle-button'>Close</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Modal;