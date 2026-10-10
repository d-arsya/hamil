import axios from "axios";

const pasienApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

pasienApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if ((err.response?.status === 401 || err.response?.status === 403) && !window.location.pathname.startsWith("/ibu/login")) {
      window.location.href = "/ibu/login";
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
