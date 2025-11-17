import axios from 'axios';

// La URL del API debe estar configurada en el archivo .env
// Si no está configurada, mostrar error en desarrollo
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error('⚠️ ERROR: VITE_API_URL no está configurada en el archivo .env del frontend');
  console.error('Por favor, crea un archivo .env en la carpeta frontend/ con:');
  console.error('VITE_API_URL=http://localhost:8080');
  throw new Error('VITE_API_URL no está configurada. Revisa el archivo .env del frontend.');
}

// Configurar axios con interceptores para agregar el token
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token a las peticiones
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

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Solo redirigir si NO es una petición de login o set-password
    // El login y set-password manejan sus propios errores 401
    if (error.response?.status === 401 && 
        !error.config?.url?.includes('/auth/login') && 
        !error.config?.url?.includes('/auth/set-password')) {
      // Token inválido o expirado en otras rutas
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  // Login
  async login(codigo, password) {
    const response = await api.post('/auth/login', { codigo, password });
    return response.data;
  },

  // Establecer contraseña (primer inicio)
  async setPassword(userId, codigo, email, newPassword) {
    const response = await api.post('/auth/set-password', {
      userId,
      codigo,
      email,
      newPassword,
    });
    return response.data;
  },

  // Obtener usuario actual
  async getCurrentUser() {
    const response = await api.get('/api/me');
    return response.data;
  },

  // Guardar token
  saveToken(token) {
    localStorage.setItem('token', token);
  },

  // Obtener token
  getToken() {
    return localStorage.getItem('token');
  },

  // Guardar usuario
  saveUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  // Obtener usuario
  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Cerrar sesión
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Verificar si está autenticado
  isAuthenticated() {
    return !!this.getToken();
  },
};

export default api;

