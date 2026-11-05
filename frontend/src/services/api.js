import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((request) => {
  const token = localStorage.getItem('attendance-token');
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

export function errorMessage(error) {
  return error.response?.data?.message || error.message || 'Something went wrong.';
}

export default api;
