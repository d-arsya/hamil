import axios from "axios";

const pasienApi = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api` });

pasienApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("pasien_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

pasienApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem("pasien_token");
      if (!window.location.pathname.startsWith("/pasien/login")) window.location.href = "/pasien/login";
    }
    return Promise.reject(err);
  }
);

export const pasienError = (e, fallback = "Terjadi kesalahan. Coba lagi.") => {
  const d = e.response?.data?.detail;
  if (typeof d === "string") return d;
  return fallback;
};

export default pasienApi;
