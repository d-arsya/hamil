import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, Baby, CalendarHeart, ChevronRight, ClipboardList, History, LogOut, Route, Bell } from "lucide-react";
import { toast } from "sonner";
import pasienApi from "../../lib/pasienApi";
import { usePasien } from "./PasienLayout";

const MENU = [
  { to: "/ibu/mingguan", icon: ClipboardList, label: "Pemantauan Mingguan", desc: "Checklist mingguan Buku KIA" },
  { to: "/ibu/bahaya", icon: AlertTriangle, label: "Tanda Bahaya", desc: "Kenali tanda bahaya kehamilan" },
  { to: "/ibu/persiapan", icon: Baby, label: "Persiapan Persalinan", desc: "Checklist persiapan melahirkan" },
  { to: "/ibu/perjalanan", icon: Route, label: "Perjalanan Kehamilan", desc: "Timeline kontrol dari klinik" },
  { to: "/ibu/edukasi", icon: CalendarHeart, label: "Edukasi", desc: "Tips sehat untuk Ibu" },
  { to: "/ibu/riwayat", icon: History, label: "Riwayat Saya", desc: "Semua catatan pemantauan" },
];

const REMINDERS = [
  ["ttd", "Reminder TTD/MMS"],
  ["harian", "Reminder pemantauan harian"],
  ["gerakan", "Reminder gerakan bayi"],
  ["kontrol", "Reminder pemeriksaan kehamilan"],
  ["edukasi", "Reminder membaca edukasi"],
];

export default function Pengaturan() {
  const { me, reload } = usePasien();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState(null);
  const p = me.pasien;

  useEffect(() => {
    pasienApi.get("/pasien/pengingat").then((r) => setReminders(r.data)).catch(() => {});
  }, []);

  const toggleReminder = async (k) => {
    const next = { ...reminders, [k]: !reminders[k] };
    setReminders(next);
    await pasienApi.put("/pasien/pengingat", { items: next });
    toast.success("Pengingat diperbarui");
  };

  const logout = () => {
    localStorage.removeItem("pasien_token");
    navigate("/ibu/login");
  };

  return (
    <div className="space-y-4" data-testid="pengaturan-page">
      <h1 className="text-xl font-extrabold text-slate-900">Lainnya</h1>

      <div className="space-y-2">
        {MENU.map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to} data-testid={`menu-${to.split("/").pop()}`} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-4 active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 rounded-2xl bg-[#FDF2F5] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[#C02650]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-800">{label}</div>
              <div className="text-[11px] text-slate-400">{desc}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-5" data-testid="reminder-section">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-[#C02650]" />
          <span className="text-sm font-bold text-slate-900">Pengingat</span>
        </div>
        {!reminders ? <p className="text-xs text-slate-400">Memuat...</p> : (
          <div className="space-y-1">
            {REMINDERS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700">{label}</span>
                <button
                  data-testid={`reminder-${k}`}
                  onClick={() => toggleReminder(k)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${reminders[k] ? "bg-[#C02650]" : "bg-slate-200"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${reminders[k] ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-2">Pengingat ditampilkan sebagai banner di beranda saat dibuka.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-5">
        <div className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-[#C02650]" /> Kontak Darurat</div>
        <div className="text-xs text-slate-500 space-y-1">
          <div>Pendamping: <b className="text-slate-700">{p.nama_pendamping || "-"}</b></div>
          <div>Kontak darurat: <b className="text-slate-700">{p.kontak_darurat || "-"}</b></div>
          <div>Faskes: <b className="text-slate-700">{p.faskes || "-"}</b></div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Hubungi bidan jika ada data yang perlu diubah.</p>
      </div>

      <button onClick={logout} data-testid="pasien-logout" className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-red-200 text-red-600 text-sm font-bold bg-white">
        <LogOut className="w-4 h-4" /> Keluar
      </button>
    </div>
  );
}
