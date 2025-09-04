import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { fetchUserInfo } from '../services/api';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null); // Stores { id, email, role, created_at }
    const [isLoading, setIsLoading] = useState(true);

    const verifyTokenAndFetchUser = useCallback(async (currentToken) => {
        try {
            const decodedToken = jwtDecode(currentToken);
            const currentTime = Date.now() / 1000;
            if (decodedToken.exp < currentTime) {
                console.log("Token expired.");
                return null; // Indicate token is invalid
            }
            // Token seems valid structurally and time-wise, fetch user info to fully validate
            const response = await fetchUserInfo(); // Uses interceptor with currentToken
            return response.data; // Return user data { id, email, role, ... }
        } catch (error) {
            console.error("Token verification or user fetch failed:", error);
             // Check if the error is specifically a 401 from fetchUserInfo
             if (error.response && error.response.status === 401) {
                console.log("Token invalid according to server (401).");
             }
            return null; // Indicate token/user is invalid
        }
    }, []); // No dependencies, fetchUserInfo uses token from storage via interceptor

    useEffect(() => {
        const initializeAuth = async () => {
            setIsLoading(true);
            const storedToken = localStorage.getItem('token');
            let validUser = null;

            if (storedToken) {
                validUser = await verifyTokenAndFetchUser(storedToken);
            }

            if (validUser) {
                setToken(storedToken);
                setUser(validUser);
                console.log("User authenticated:", validUser.email, "Role:", validUser.role);
            } else {
                localStorage.removeItem('token'); // Clean up invalid token
                setToken(null);
                setUser(null);
            }
            setIsLoading(false);
        };

        initializeAuth();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount

    const login = useCallback(async (newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setIsLoading(true); // Indicate loading user info
        const loggedInUser = await verifyTokenAndFetchUser(newToken);
        if (loggedInUser) {
            setUser(loggedInUser);
        } else {
            // Login succeeded but fetching user info failed immediately? Unlikely but possible.
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
        }
        setIsLoading(false);
    }, [verifyTokenAndFetchUser]);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        // Navigation should be handled by routing logic in App.js
        console.log("User logged out.");
    }, []);

    const value = {
        token,
        user, // Contains user info including role
        isLoading,
        login,
        logout,
        isAuthenticated: !!token && !!user, // Check user object as well
    };

    // Render children only after initial loading is complete
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook remains the same
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};