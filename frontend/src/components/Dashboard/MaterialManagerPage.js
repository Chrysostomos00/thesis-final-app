import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MaterialManager from './MaterialManager'; // Reuse the component
import { getMaterials } from '../../services/api';
import { FaArrowLeft, FaBook } from 'react-icons/fa';
import '../../styles/TeacherDashboard.css';

function MaterialManagerPage() {
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(''); // Added success state

    // Callbacks for messages
    const clearMessages = useCallback(() => { setError(''); setSuccess(''); }, []);
    const showSuccess = useCallback((msg) => { setSuccess(msg); setError(''); setTimeout(clearMessages, 3000); }, [clearMessages]);
    const showError = useCallback((msg) => { setError(msg); setSuccess(''); }, []);

    const fetchMats = useCallback(async () => {
        setIsLoading(true); clearMessages(); // Clear messages on fetch
        try {
            const r = await getMaterials();
            setMaterials(r.data || []);
        } catch(e) {
            showError('Failed to load materials. Please refresh.'); console.error(e);
            setMaterials([]); // Ensure empty array on error
        } finally {
            setIsLoading(false);
        }
    }, [showError]); // Added showError dependency

    useEffect(() => { fetchMats(); }, [fetchMats]);

    // Dummy click handler as we don't add summaries from this page
    const handleDummyClick = () => {
        showSuccess("To add a material summary to a prompt, please go to the 'AI Assistants' workshop.");
    };

    return (
        <div className="material-manager-page page-content-wrapper"> {/* Added wrapper class */}
             <div className="page-header">
                 <Link to="/teacher/dashboard" className='subtle-button back-button'>
                     <FaArrowLeft /> Πίσω στη Κεντρική
                 </Link>
                <h2><FaBook/> Διαχείρηση Εκπαιδευτικού Υλικού</h2>
                 {/* Add Upload button directly here? Or keep inside MaterialManager */}
             </div>
             {error && <div className="message error-message global-message">{error} <button onClick={clearMessages}>X</button></div>}
             {success && <div className="message success-message global-message">{success} <button onClick={clearMessages}>X</button></div>}
             <MaterialManager
                materials={materials}
                setMaterials={setMaterials} // Allow deletion from here too
                onMaterialClick={handleDummyClick} // Different action/message here
                isLoading={isLoading}
                refreshMaterials={fetchMats}
                showError={showError}
                showSuccess={showSuccess}
                clearMessages={clearMessages}
            />
        </div>
    );
}
export default MaterialManagerPage;