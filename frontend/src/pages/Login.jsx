import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeartPulse, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(apiError(err, "Login gagal"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FAF8F5]">
      <div className="hidden lg:block lg:w-[46%] relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/7108418/pexels-photo-7108418.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1080&w=940"
          alt="Pemeriksaan ibu hamil"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/85 via-[#0F172A]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 p-10 text-white">
          <h2 className="text-3xl font-extrabold tracking-tight mb-3">Pantau setiap kehamilan sampai masa nifas.</h2>
          <p className="text-sm text-white/80 max-w-md leading-relaxed">
            Jadwal kontrol otomatis dari HPHT, pengingat WhatsApp, dan riwayat pemeriksaan dalam satu dashboard.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-2xl bg-[#C02650] flex items-center justify-center">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-slate-900">BidanKu</div>
              <div className="text-xs text-slate-500">Monitoring Ibu Hamil & Nifas</div>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-1.5">Masuk ke akun Anda</h1>
          <p className="text-sm text-slate-500 mb-8">Gunakan username dan password bidan.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Username</label>
              <input
                data-testid="login-username-input"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors bg-white"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
              <input
                data-testid="login-password-input"
                type="password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div data-testid="login-error" className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {error}
              </div>
            )}
            <button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
          <p className="text-[11px] text-slate-400 mt-6">Hubungi bidan/admin pemilik akun jika lupa kredensial.</p>
          <a href="/ibu/login" data-testid="pasien-login-link" className="block text-center text-xs font-bold text-[#C02650] hover:underline mt-3">
            Ibu pasien? Masuk ke portal pasien di sini →
          </a>
        </div>
      </div>
    </div>
  );
}
