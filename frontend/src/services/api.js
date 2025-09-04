import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Uses the proxy in development (setupProxy.js)
});

// Interceptor to add the JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle API errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(
        `Axios Error: Status ${error.response?.status} for ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        error.response?.data || error.message
    );
    if (error.response && error.response.status === 401) {
      console.error("Unauthorized access - 401 detected by interceptor. Token might be invalid or user session expired.");
    }
     if (error.code === 'ECONNREFUSED') {
        console.error("Axios Interceptor: Connection Refused. The backend server is likely down or the proxy is misconfigured.");
     } else if (error.response?.status === 504) {
        console.error("Axios Interceptor: Gateway Timeout. The proxy connected, but the backend server did not respond in time.");
     }
    return Promise.reject(error);
  }
);


// --- Auth Service Functions ---
export const registerUser = (email, password, role = 'student') => api.post('/register', { email, password, role });

// >> CHANGE: Updated loginUser to accept and send the role
export const loginUser = (email, password, role) => api.post('/login', { email, password, role });
// << END CHANGE

export const fetchUserInfo = () => api.get('/user');

// --- Teacher Material Service Functions ---
export const uploadMaterial = (formData) => api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getMaterials = () => api.get('/materials');
export const deleteMaterial = (materialId) => api.delete(`/materials/${materialId}`);

// --- Teacher Prompt Service Functions ---
export const savePrompt = (promptData) => api.post('/prompts', promptData);
export const getTeacherPrompts = () => api.get('/prompts');
export const getPromptDetails = (promptId) => api.get(`/prompts/${promptId}`);
export const updatePrompt = (promptId, promptData) => api.put(`/prompts/${promptId}`, promptData);
export const deletePrompt = (promptId) => api.delete(`/prompts/${promptId}`);

// --- Teacher AI Sandbox Function (MODIFIED) ---
export const generateTestResponse = (payload) => api.post('/generate', payload);

// --- Teacher Quiz Generation Function ---
export const generateQuizQuestionsAI = (data) => {
    return api.post('/generate/quiz', data, {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}
// --- Teacher Quiz Management Functions ---
export const createTeacherQuiz = (quizData) => api.post('/quizzes', quizData);
export const getTeacherQuizzes = () => api.get('/quizzes');
export const getTeacherQuizDetails = (quizId) => api.get(`/quizzes/${quizId}`);
export const updateTeacherQuiz = (quizId, quizData) => api.put(`/quizzes/${quizId}`, quizData);
export const deleteTeacherQuiz = (quizId) => api.delete(`/quizzes/${quizId}`);
export const getTeacherQuizAttempts = (quizId) => api.get(`/teachers/quizzes/${quizId}/attempts`);

// --- Student Prompt/Assistant Functions ---
export const getStudentPrompts = () => api.get('/student/prompts');
export const askAssistant = (prompt_id, question) => api.post('/student/ask', { prompt_id, question });

// --- Student Quiz Functions ---
export const getStudentQuizzes = () => api.get('/student/quizzes');
export const takeStudentQuiz = (quizId) => api.get(`/student/quizzes/${quizId}/take`);
export const submitStudentQuiz = (quizId, answers) => api.post(`/student/quizzes/${quizId}/submit`, { answers });
export const getStudentAttemptDetails = (attemptId) => api.get(`/student/attempts/${attemptId}`);


export default api;