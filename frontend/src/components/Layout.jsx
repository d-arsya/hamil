import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Menu, X, LogOut, HeartPulse, BookOpen, BarChart3, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import api, { apiError } from "../lib/api";
import Modal from "./Modal";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/pasien", label: "Daftar Pasien", icon: Users, testid: "nav-pasien" },
  { to: "/edukasi", label: "Edukasi", icon: BookOpen, testid: "nav-edukasi" },
  { to: "/laporan", label: "Laporan", icon: BarChart3, testid: "nav-laporan" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ lama: "", baru: "", konfirmasi: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const submitPassword = async () => {
    if (!pwForm.lama || !pwForm.baru) {
      toast.error("Isi password lama dan baru");
      return;
    }
    if (pwForm.baru !== pwForm.konfirmasi) {
      toast.error("Konfirmasi password baru tidak sama");
      return;
    }
    setPwSaving(true);
    try {
      await api.post("/auth/change-password", { password_lama: pwForm.lama, password_baru: pwForm.baru });
      toast.success("Password berhasil diganti");
      setPwOpen(false);
      setPwForm({ lama: "", baru: "", konfirmasi: "" });
    } catch (err) {
      toast.error(apiError(err, "Gagal mengganti password"));
    } finally {
      setPwSaving(false);
    }
  };

  const sidebar = (suffix = "") => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-6 py-6 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-[#C02650] flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-extrabold text-lg tracking-tight text-slate-900">BidanKu</div>
          <div className="text-[11px] text-slate-500 -mt-0.5">Monitoring Ibu Hamil & Nifas</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-testid={`${testid}${suffix}`}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive ? "bg-[#FDF2F5] text-[#C02650]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
            {(user?.nama || user?.username || "B")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate" data-testid={`sidebar-user-name${suffix}`}>{user?.nama || user?.username}</div>
            <div className="text-xs text-slate-500">Bidan</div>
          </div>
        </div>
        <button
          data-testid={`change-password-button${suffix}`}
          onClick={() => setPwOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-[#C02650] transition-colors mb-2"
        >
          <KeyRound className="w-4 h-4" />
          Ganti Password
        </button>
        <button
          data-testid={`logout-button${suffix}`}
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200/80 z-30">{sidebar("")}</aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar("-mobile")}</aside>
        </div>
      )}

      <div className="lg:ml-64">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-8 py-3.5 flex items-center gap-3">
          <button
            data-testid="mobile-menu-button"
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setOpen(true)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="text-sm text-slate-500" data-testid="topbar-date">{today}</div>
        </header>
        <main className="px-4 py-6 md:px-8 md:py-8 max-w-7xl">
          <Outlet />
        </main>
      </div>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Ganti Password" testid="change-password-modal">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password Lama</label>
            <input
              data-testid="pw-old-input"
              type="password"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
              value={pwForm.lama}
              onChange={(e) => setPwForm((f) => ({ ...f, lama: e.target.value }))}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password Baru (min. 8 karakter)</label>
            <input
              data-testid="pw-new-input"
              type="password"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
              value={pwForm.baru}
              onChange={(e) => setPwForm((f) => ({ ...f, baru: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Konfirmasi Password Baru</label>
            <input
              data-testid="pw-confirm-input"
              type="password"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
              value={pwForm.konfirmasi}
              onChange={(e) => setPwForm((f) => ({ ...f, konfirmasi: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <button
            data-testid="pw-submit-button"
            onClick={submitPassword}
            disabled={pwSaving}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60"
          >
            {pwSaving ? "Menyimpan..." : "Simpan Password Baru"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
