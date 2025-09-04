// src/components/common/NotFound.js
import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/App.css'; // Or create a specific NotFound.css if needed

function NotFound() {
    return (
        <div className="not-found-container">
            <h2>404 - Page Not Found</h2>
            <p>Sorry, the page you are looking for does not exist.</p>
            <Link to="/">Go to Homepage</Link>
        </div>
    );
}

export default NotFound;