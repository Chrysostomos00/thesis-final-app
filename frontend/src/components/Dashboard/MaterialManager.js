import React, { useState } from 'react';
import { uploadMaterial, deleteMaterial } from '../../services/api';
import { FaUpload, FaTrash, FaSpinner, FaFilePdf, FaFilePowerpoint, FaFileAlt } from 'react-icons/fa'; // Import icons
import '../../styles/MaterialManager.css'; // Create this CSS file

const MAX_FILE_SIZE_MB = 32;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function MaterialManager({ materials, setMaterials, onMaterialClick, isLoading, refreshMaterials, showError, showSuccess, clearMessages }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null); // Store ID of material being deleted

    const handleFileChange = (event) => {
        clearMessages();
        const file = event.target.files[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                 showError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
                 setSelectedFile(null);
                 event.target.value = null; // Clear the input
            } else {
                setSelectedFile(file);
            }
        } else {
            setSelectedFile(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            showError("Please select a file to upload.");
            return;
        }
        clearMessages();
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await uploadMaterial(formData);
            // No need to update state directly, refreshMaterials handles it
            showSuccess(`"${response.data.name}" uploaded successfully! Summary is being generated.`);
            setSelectedFile(null); // Clear selection
            document.getElementById('material-file-input').value = null; // Reset file input visually
             await refreshMaterials(); // Refresh the list from the backend
        } catch (error) {
            console.error('Upload failed:', error);
            showError(error.response?.data?.error || 'File upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

     const handleDelete = async (materialId, materialName) => {
        // Optional: Add a confirmation dialog
        if (!window.confirm(`Are you sure you want to delete "${materialName}"? This cannot be undone.`)) {
            return;
        }

        clearMessages();
        setIsDeleting(materialId); // Indicate which item is being deleted
        try {
            await deleteMaterial(materialId);
            showSuccess(`Material "${materialName}" deleted successfully.`);
            // Update the state locally for immediate feedback OR rely on refresh
            setMaterials(prevMaterials => prevMaterials.filter(m => m.id !== materialId));
            // Optionally call refreshMaterials() again if needed, but local removal is faster UI-wise
        } catch (error) {
             console.error('Delete failed:', error);
             showError(error.response?.data?.error || 'Failed to delete material.');
        } finally {
            setIsDeleting(null); // Clear deleting state
        }
    };

    const getFileIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'pdf') return <FaFilePdf className="file-icon pdf" />;
        if (ext === 'ppt' || ext === 'pptx') return <FaFilePowerpoint className="file-icon ppt" />;
        if (ext === 'txt') return <FaFileAlt className="file-icon txt" />;
        return <FaFileAlt className="file-icon other" />;
    };


    return (
        <div className="widget material-manager">
            <h3><FaUpload /> Ανεβάστε Υλικό</h3>
            <div className="upload-controls">
                <input
                    type="file"
                    id="material-file-input"
                    onChange={handleFileChange}
                    accept=".pdf,.ppt,.pptx,.txt" // Specify allowed types
                    disabled={isUploading}
                />
                <button onClick={handleUpload} disabled={!selectedFile || isUploading}>
                    {isUploading ? <><FaSpinner className="spin" /> Uploading...</> : 'Upload File'}
                </button>
            </div>
             {selectedFile && <p className="selected-file-info">Selected: {selectedFile.name}</p>}

            <div className="material-list-container">
                <h4>Ανεβασμένο Υλικό</h4>
                {isLoading ? (
                    <p><FaSpinner className="spin" /> Loading materials...</p>
                ) : materials && materials.length > 0 ? (
                    <ul className="material-list">
                        {materials.map((material) => (
                            <li key={material.id} className={`material-item ${isDeleting === material.id ? 'deleting' : ''}`}>
                                <div
                                    className="material-info"
                                    onClick={() => onMaterialClick(material)}
                                    title={`Click to add summary to prompt\nSummary: ${material.summary || 'N/A'}`}
                                >
                                    {getFileIcon(material.name)}
                                    <span className="material-name">{material.name}</span>
                                </div>
                                <button
                                    className="delete-button subtle-button"
                                    onClick={() => handleDelete(material.id, material.name)}
                                    disabled={isDeleting === material.id}
                                    title="Delete material"
                                >
                                    {isDeleting === material.id ? <FaSpinner className="spin" /> : <FaTrash />}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="empty-list-message">Δεν έχετε ανεβασει ακόμα υλικό.</p>
                )}
            </div>
        </div>
    );
}

export default MaterialManager;