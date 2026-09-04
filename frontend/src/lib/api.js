import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const apiError = (e, fallback = "Terjadi kesalahan. Coba lagi.") => {
  const detail = e.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).filter(Boolean).join(" ");
  return fallback;
};

export default api;
