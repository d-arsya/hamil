import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, CalendarClock, AlertTriangle, Baby, MessageCircle, ArrowRight, UserPlus } from "lucide-react";
import api from "../lib/api";
import StatusBadge, { FaseBadge, RiskBadges, riskNameColor } from "../components/StatusBadge";
import WaReminder from "../components/WaReminder";
import PatientForm from "../components/PatientForm";
import { useAuth } from "../context/AuthContext";
import { fmtDate, usiaLabel } from "../lib/utils-id";

const cardCls = "bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md transition-shadow";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [waPatient, setWaPatient] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => api.get("/dashboard").then((r) => setData(r.data));
  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return <div className="text-sm text-slate-400 animate-pulse" data-testid="dashboard-loading">Memuat dashboard...</div>;
  }

  const { stats, perlu_tindakan } = data;

  const cards = [
    { label: "Total Pasien", value: stats.total, icon: Users, cls: "bg-slate-900 text-white", testid: "stat-total" },
    { label: "Kontrol Hari Ini", value: stats.hari_ini, icon: CalendarClock, cls: "bg-[#C02650] text-white", testid: "stat-hari-ini" },
    { label: "Terlambat Kontrol", value: stats.terlambat, icon: AlertTriangle, cls: "bg-red-50 text-red-600", testid: "stat-terlambat" },
    { label: "Pasien Nifas", value: stats.nifas, icon: Baby, cls: "bg-purple-50 text-purple-600", testid: "stat-nifas" },
  ];

  return (
    <div data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Selamat datang, {user?.nama || "Bidan"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Ringkasan jadwal kontrol pasien hari ini.</p>
        </div>
        <button
          data-testid="dashboard-add-patient-button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Tambah Pasien
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, cls, testid }) => (
          <div key={label} className={cardCls} data-testid={testid}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${cls}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Perlu Tindakan</h2>
          <Link to="/pasien" data-testid="dashboard-see-all-link" className="flex items-center gap-1 text-xs font-semibold text-[#C02650] hover:underline">
            Lihat semua pasien <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {perlu_tindakan.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400" data-testid="dashboard-empty-state">
            Tidak ada pasien yang perlu kontrol dalam waktu dekat.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {perlu_tindakan.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors" data-testid={`dashboard-row-${p.id}`}>
                <div className="flex-1 min-w-[160px]">
                  <Link to={`/pasien/${p.id}`} className={`text-sm font-bold hover:underline transition-colors ${riskNameColor(p.penyakit_penyerta) || "text-slate-900 hover:text-[#C02650]"}`}>
                    {p.nama}
                  </Link>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <RiskBadges penyakit={p.penyakit_penyerta} testidPrefix={`risk-dash-${p.id}`} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{usiaLabel(p)} · {p.kunjungan_berikutnya ? `Kunjungan ${p.kunjungan_berikutnya}` : "Selesai"}</div>
                </div>
                <div className="hidden sm:block">
                  <FaseBadge fase={p.fase} />
                </div>
                <div className="text-xs text-slate-600 w-28">
                  <div className="font-semibold">{fmtDate(p.jadwal_berikutnya)}</div>
                  <div className="text-slate-400">jadwal kontrol</div>
                </div>
                <StatusBadge status={p.status} />
                <button
                  data-testid={`dashboard-wa-button-${p.id}`}
                  onClick={() => setWaPatient(p)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#25D366]/10 text-[#128C4A] border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Ingatkan WA
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <WaReminder open={Boolean(waPatient)} onClose={() => setWaPatient(null)} patient={waPatient} bidanNama={user?.nama} />
      <PatientForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} />
    </div>
  );
}
