import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { HeartPulse, Loader2 } from "lucide-react";
import pasienApi, { pasienError } from "../../lib/pasienApi";
import { DISCLAIMER } from "../../lib/konten";

export default function PasienLogin() {
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
      await pasienApi.post("/pasien/login", { username, password });
      navigate("/ibu");
    } catch (err) {
      setError(pasienError(err, "Login gagal"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] bg-white";

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-5" data-testid="pasien-login-page">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-[#C02650] flex items-center justify-center mb-3">
            <HeartPulse className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">BidanKu untuk Ibu</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">Teman pendamping kehamilan Ibu</p>
        </div>

        <form onSubmit={submit} className="space-y-4 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
            <input data-testid="pasien-username-input" className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <input data-testid="pasien-password-input" type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && (
            <div data-testid="pasien-login-error" className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">{error}</div>
          )}
          <button type="submit" data-testid="pasien-login-submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl text-base font-bold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60">
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? "Memproses..." : "Masuk"}
          </button>
          <p className="text-xs text-slate-400 text-center">Username & password diberikan oleh bidan/klinik Ibu.</p>
        </form>

        <Link to="/login" data-testid="clinic-login-link" className="block text-center text-xs font-semibold text-slate-400 hover:text-[#C02650] mt-5 transition-colors">
          Bidan / petugas klinik? Masuk di sini
        </Link>
        <p className="text-[10px] text-slate-400 text-center mt-6 leading-relaxed">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
