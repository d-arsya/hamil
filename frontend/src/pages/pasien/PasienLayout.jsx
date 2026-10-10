import { useCallback, useEffect, useState } from "react";
import { Outlet, NavLink, useOutletContext } from "react-router-dom";
import { Home, Activity, Pill, Baby, Menu as MenuIcon, HeartPulse } from "lucide-react";
import pasienApi from "../../lib/pasienApi";
import { DISCLAIMER } from "../../lib/konten";
import Onboarding from "./Onboarding";

export const usePasien = () => useOutletContext();

const NAV = [
  { to: "/ibu", label: "Beranda", icon: Home, end: true },
  { to: "/ibu/pantau", label: "Pantau", icon: Activity },
  { to: "/ibu/ttd", label: "TTD", icon: Pill },
  { to: "/ibu/gerakan", label: "Bayi", icon: Baby },
  { to: "/ibu/pengaturan", label: "Lainnya", icon: MenuIcon },
];

export default function PasienLayout() {
  const [me, setMe] = useState(null);

  const load = useCallback(() => pasienApi.get("/pasien/me").then((r) => setMe(r.data)).catch(() => {}), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]" data-testid="pasien-loading">
        <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>
      </div>
    );
  }

  if (!me.pasien.profil_lengkap) {
    return <Onboarding pasien={me.pasien} onDone={load} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-28" data-testid="pasien-app">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[#C02650] flex items-center justify-center">
          <HeartPulse className="w-4 h-4 text-white" />
        </div>
        <div className="text-sm font-extrabold text-slate-900">BidanKu</div>
        <div className="ml-auto text-xs font-semibold text-slate-500 truncate max-w-[140px]">{me.pasien.nama}</div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5">
        <Outlet context={{ me, reload: load }} />
        <p className="text-[10px] text-slate-400 text-center mt-8 leading-relaxed" data-testid="pasien-disclaimer">{DISCLAIMER}</p>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200/80">
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`pasien-nav-${label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors ${isActive ? "text-[#C02650]" : "text-slate-400"}`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
