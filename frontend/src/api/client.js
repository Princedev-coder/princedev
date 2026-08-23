import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      const isLogin = err.config && /auth\/login/.test(err.config.url || '');
      if (!isLogin) {
        localStorage.removeItem('hp_token');
        localStorage.removeItem('hp_user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export function apiGet(url, params) {
  return api.get(url, { params }).then((r) => {
    const data = r.data.data;
    if (r.data.meta && Array.isArray(data)) data.meta = r.data.meta;
    return data;
  });
}

export function apiPost(url, body) {
  return api.post(url, body).then((r) => r.data.data);
}

export function apiPut(url, body) {
  return api.put(url, body).then((r) => r.data.data);
}

export function apiDelete(url) {
  return api.delete(url).then((r) => r.data.data);
}

export function errorMessage(err, fallback = 'Request failed') {
  const msg = err?.response?.data?.message;
  const details = err?.response?.data?.details;
  if (msg) return details && details.length ? `${msg}: ${details[0].message}` : msg;
  return fallback;
}

export default api;
