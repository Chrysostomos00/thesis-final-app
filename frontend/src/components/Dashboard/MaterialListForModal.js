// frontend/src/components/Dashboard/MaterialListForModal.js
import React from 'react';
import { FaSpinner, FaFilePdf, FaFilePowerpoint, FaFileAlt, FaBookOpen } from 'react-icons/fa';
// Path for shared styles (assuming PromptWorkshop.css has some useful list styles)
// or TeacherDashboard.css (contains .material-list styles if you kept them there)
// Ensure this path correctly targets your main material list styles.
// If you centralized list styles in App.css, point there.
import '../../styles/TeacherDashboard.css'; // If .material-list and .material-item are here
import '../../styles/Modal.css'; // For potential modal-specific list styling overrides if needed

function MaterialListForModal({ materials, onMaterialClick, isLoading, showError }) {
    if (isLoading) {
        return (
            <div className="loading-items" style={{minHeight: '200px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <FaSpinner className="spin" /> Loading materials...
            </div>
        );
    }

    if (!materials || materials.length === 0) {
        return (
            <div className="empty-list-message" style={{ margin: '1rem 0' }}>
                <FaBookOpen size={28} style={{ marginBottom: '0.5rem', opacity: 0.7 }}/>
                <p>No materials have been uploaded yet.</p>
                <p style={{fontSize: '0.85em'}}>You can upload materials from the main "Manage Materials" section.</p>
            </div>
        );
    }

    const getFileIcon = (filename = "") => {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'pdf') return <FaFilePdf className="file-icon pdf" />;
        if (ext === 'ppt' || ext === 'pptx') return <FaFilePowerpoint className="file-icon ppt" />;
        if (ext === 'txt') return <FaFileAlt className="file-icon txt" />;
        return <FaFileAlt className="file-icon other" />;
    };

    return (
        <div className="material-list-modal-content">
            {/* We can reuse the .material-list class and its child .material-item from TeacherDashboard.css */}
            {/* Ensure TeacherDashboard.css (or wherever you defined them) is properly imported */}
            {/* or copy relevant styles into Modal.css / PromptWorkshop.css with more specific selectors */}
            <p style={{fontSize: '0.9em', color: 'var(--text-color-secondary)', marginBottom: '1rem'}}>
                Select a material to add its AI-generated summary as a new block in your prompt.
            </p>
            <ul className="material-list">
                {materials.map((material) => (
                    <li
                        key={material.id}
                        className="material-item" // Style this in TeacherDashboard.css or a common list style
                        onClick={() => {
                            if (!material.summary || material.summary.startsWith("Error") || material.summary === "N/A") {
                                showError(`Material "${material.name}" has no usable summary or an error occurred during its generation. Please check the material or re-upload.`);
                                return;
                            }
                            onMaterialClick(material);
                        }}
                        title={`Add summary for: ${material.name}\nSummary: ${material.summary ? material.summary.substring(0, 100) + '...' : 'Not available or generation failed'}`}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="material-info">
                            {getFileIcon(material.name)}
                            <span className="material-name">{material.name}</span>
                        </div>
                        {/* No delete button or other actions in this modal context */}
                        <span className="material-summary-preview" style={{fontSize: '0.8em', color: 'var(--text-color-muted)', marginLeft: 'auto', fontStyle:'italic'}}>
                             {material.summary && !material.summary.startsWith("Error") && material.summary !== "N/A" ? `(~${material.summary.split(' ').length} words)` : '(No summary)'}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
export default MaterialListForModal;