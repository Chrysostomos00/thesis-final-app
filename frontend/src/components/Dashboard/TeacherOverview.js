import React from 'react';
import { Link } from 'react-router-dom';
import { FaRobot, FaClipboardList, FaChartBar, FaBook, FaUserCog, FaUserGraduate } from 'react-icons/fa';
import '../../styles/TeacherDashboard.css';

function TeacherOverview() {
    return (
        <div className="dashboard-overview">
            <h2>Επισκόπηση Πίνακα Ελέγχου</h2>
            <p>Καλώς ορίσατε! Επιλέξτε μια ενέργεια από τις παρακάτω κάρτες.</p>
            <div className="dashboard-cards">
                {/* Card for AI Assistants */}
                <Link to="/teacher/dashboard/prompts" className="dashboard-card">
                    <FaRobot size={35} />
                    <h3>Βοηθοί AI</h3>
                    <p>Δημιουργήστε, επεξεργαστείτε και διαχειριστείτε τα μοντέλα οδηγιών για τους ψηφιακούς βοηθούς σας.</p>
                </Link>

                {/* Card for Quizzes */}
                <Link to="/teacher/dashboard/quizzes" className="dashboard-card">
                    <FaClipboardList size={35} />
                    <h3>Κουίζ</h3>
                    <p>Δημιουργήστε κουίζ με AI, επεξεργαστείτε τα χειροκίνητα, δημοσιεύστε τα και δείτε τα αποτελέσματα των μαθητών.</p>
                </Link>

                {/* Card for Analytics */}
                 <Link to="/teacher/dashboard/analytics" className="dashboard-card">
                     <FaChartBar size={35} />
                    <h3>Αναλυτικά Στοιχεία</h3>
                    <p>Παρακολουθήστε την πρόοδο των μαθητών και εντοπίστε σημεία που χρειάζονται προσοχή.</p>
                 </Link>

                 {/* Card for Materials */}
                <Link to="/teacher/dashboard/materials" className="dashboard-card">
                     <FaBook size={35} />
                    <h3>Διαχείριση Υλικών</h3>
                    <p>Ανεβάστε, δείτε και οργανώστε το εκπαιδευτικό υλικό που χρησιμοποιεί το AI.</p>
                 </Link>

                 {/* Card for Student Management (Placeholder) */}
                 <Link to="/teacher/dashboard/students" className="dashboard-card disabled-card">
                    <FaUserGraduate size={35} />
                    <h3>Διαχείριση Μαθητών</h3>
                    <p>Δείτε τη λίστα μαθητών, αναθέστε κουίζ, διαχειριστείτε ομάδες (Σύντομα διαθέσιμο).</p>
                 </Link>

                 {/* Card for Account Settings (Placeholder) */}
                 <Link to="/teacher/dashboard/settings" className="dashboard-card disabled-card">
                     <FaUserCog size={35} />
                     <h3>Ρυθμίσεις Λογαριασμού</h3>
                     <p>Διαχειριστείτε το προφίλ σας και τις ρυθμίσεις της εφαρμογής (Σύντομα διαθέσιμο).</p>
                 </Link>
            </div>
        </div>
    );
}

export default TeacherOverview;