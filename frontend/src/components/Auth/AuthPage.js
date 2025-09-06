import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { loginUser, registerUser } from '../../services/api';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import '../../styles/Auth.css';
// Εισαγωγή του λογότυπου από τον φάκελο assets
import logo from '../../assets/logo.png';

function AuthForm({ formType, userRole }) {
  const timerRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();


  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setLoading(false);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [formType, userRole, location.pathname]);
  
  const isLogin = formType === 'login';
  const from = location.state?.from?.pathname || (userRole === 'teacher' ? "/teacher/dashboard" : "/student/dashboard");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!isLogin) { // Registration logic
      if (password !== confirmPassword) {
        setError("Οι κωδικοί πρόσβασης δεν ταιριάζουν.");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
        setLoading(false);
        return;
      }
      try {
        const response = await registerUser(email, password, userRole);
        setSuccess(response.data.message + ' Ανακατεύθυνση στη σύνδεση...');
        setLoading(false); // σημαντικό: να μην “κολλάει” το κουμπί
        timerRef.current = setTimeout(() => {
          navigate(`/${userRole}/login`, { replace: true, state: { justRegistered: true } });
        }, 1500);
      } catch (err) {
        setError(err.response?.data?.error || 'Η εγγραφή απέτυχε. Παρακαλώ προσπαθήστε ξανά.');
        setLoading(false);
      }
    } else { // Login logic
      try {
        const response = await loginUser(email, password, userRole); // Pass the role
        await login(response.data.access_token);
        setLoading(false);
        navigate(from, { replace: true });
      } catch (err) {
        setError(err.response?.data?.error || 'Η σύνδεση απέτυχε. Ελέγξτε τα στοιχεία σας.');
        setLoading(false);
      }
    }
  };

  const roleText = userRole === 'teacher' ? 'Εκπαιδευτικού' : 'Μαθητή';
  const otherRoleText = userRole === 'teacher' ? 'Μαθητής' : 'Εκπαιδευτικός';
  const otherRoleLink = userRole === 'teacher' ? 'student' : 'teacher';

  return (
    <div className="auth-container">
      <img src={logo} alt="Λογότυπο Εφαρμογής" className="auth-logo" />
      <h2>{isLogin ? `Σύνδεση ${roleText}` : `Εγγραφή ${roleText}`}</h2>
      <form onSubmit={handleSubmit}>
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} autoComplete="username" />
        </div>
        <div className="form-group">
          <label htmlFor="password">{isLogin ? 'Κωδικός Πρόσβασης:' : 'Κωδικός (min 6 χαρακτήρες):'}</label>
          <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} autoComplete={isLogin ? "current-password" : "new-password"} />
        </div>
        {!isLogin && (
          <div className="form-group">
            <label htmlFor="confirmPassword">Επιβεβαίωση Κωδικού:</label>
            <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} autoComplete="new-password" />
          </div>
        )}
        <button type="submit" className="button primary-button" disabled={loading}>
          {loading ? (isLogin ? 'Σύνδεση...' : 'Εγγραφή...') : (isLogin ? 'Σύνδεση' : 'Εγγραφή')}
        </button>
      </form>
      <p className="auth-switch">
        {isLogin ? 'Δεν έχεις λογαριασμό; ' : 'Έχεις ήδη λογαριασμό; '}
        <Link to={`/${userRole}/${isLogin ? 'register' : 'login'}`}>
          {isLogin ? `Εγγραφή ${roleText}` : `Σύνδεση ${roleText}`}
        </Link>
      </p>
      <p className="auth-switch">
        Είσαι {otherRoleText}; <Link to={`/${otherRoleLink}/login`}>Συνδέσου εδώ</Link>
      </p>
    </div>
  );
}

function AuthPage() {
    const location = useLocation();
    const pathParts = location.pathname.split('/').filter(Boolean);

    if (pathParts.length !== 2 || !['teacher', 'student'].includes(pathParts[0]) || !['login', 'register'].includes(pathParts[1])) {
        return <Navigate to="/" replace />;
    }

    const userRole = pathParts[0];
    const formType = pathParts[1];

    return <AuthForm formType={formType} userRole={userRole} />;
}

export default AuthPage;
