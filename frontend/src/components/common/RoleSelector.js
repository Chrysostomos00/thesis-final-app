import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/Auth.css';
// Εισαγωγή του λογότυπου από τον φάκελο assets
import logo from '../../assets/logo.png';
import { FaChalkboardTeacher, FaUserGraduate } from 'react-icons/fa';

function RoleSelector() {
     return (
        <div className="role-selector-container">
            <img src={logo} alt="Λογότυπο Εφαρμογής" className="auth-logo" />
            <h2>Καλώς Ορίσατε!</h2>
            <p>Επιλέξτε τον ρόλο σας για να συνεχίσετε:</p>
            <div className="role-links">
                <Link to="/teacher/login" className="role-link-button teacher">
                    <FaChalkboardTeacher />
                    <span>Είσοδος Εκπαιδευτικού</span>
                </Link>
                <Link to="/student/login" className="role-link-button student">
                    <FaUserGraduate />
                    <span>Είσοδος Μαθητή</span>
                </Link>
            </div>
             <div className="register-links">
                <Link to="/teacher/register">Εγγραφή ως Εκπαιδευτικός</Link> | <Link to="/student/register">Εγγραφή ως Μαθητής</Link>
            </div>
        </div>
    );
}

export default RoleSelector;
