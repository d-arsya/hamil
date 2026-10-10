import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const path = window.location.pathname;
    if (err.response?.status === 401 && !path.startsWith("/login") && !path.startsWith("/ibu")) {
      window.location.href = "/login";
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
