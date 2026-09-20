import axios from 'axios';

// In docker-compose, Nginx proxies /api/* to the backend container (see nginx.conf)
const api = axios.create({
  baseURL: '/api',
});

// Attach the JWT to every request once the user has logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
