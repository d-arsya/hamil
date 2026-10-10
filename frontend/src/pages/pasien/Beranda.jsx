import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Pill, Baby, AlertTriangle, CalendarClock, CheckCircle2, Circle, MessageCircle } from "lucide-react";
import pasienApi from "../../lib/pasienApi";
import { usePasien } from "./PasienLayout";
import { fmtDate, usiaLabel } from "../../lib/utils-id";
import { BERANDA_EDUKASI_TRIMESTER, EDUKASI_ARTIKEL, FASE_LABEL } from "../../lib/konten";

const card = "bg-white rounded-3xl border border-slate-200/80 p-5";

export default function Beranda() {
  const { me } = usePasien();
  const p = me.pasien;
  const [ttdToday, setTtdToday] = useState(null);
  const [pantauToday, setPantauToday] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    pasienApi.get("/pasien/ttd").then((r) => setTtdToday(r.data.find((t) => t.tanggal === today) || null)).catch(() => {});
    pasienApi.get("/pasien/pemantauan?limit=1").then((r) => setPantauToday(r.data.find((x) => x.tanggal === today) || null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minggu = p.usia_minggu ?? 0;
  const progress = Math.min(Math.round((minggu / 40) * 100), 100);
  const hplDate = p.hpl ? new Date(p.hpl + "T00:00:00") : null;
  const countdown = hplDate ? Math.ceil((hplDate - new Date()) / 86400000) : null;
  const bisaGerakan = minggu >= 24 && p.fase !== "nifas";

  const todos = [
    { label: "Minum TTD/MMS", done: ttdToday?.status === "sudah", to: "/ibu/ttd", show: true },
    { label: "Isi pemantauan hari ini", done: Boolean(pantauToday), to: "/ibu/pantau", show: true },
    { label: "Pantau gerakan bayi", done: false, to: "/ibu/gerakan", show: bisaGerakan },
  ].filter((t) => t.show);

  const artikel = [EDUKASI_ARTIKEL.ttd[0], EDUKASI_ARTIKEL.bahaya[0], ...(bisaGerakan ? [EDUKASI_ARTIKEL.bayi[0]] : []), EDUKASI_ARTIKEL.mental[0], EDUKASI_ARTIKEL.pemeriksaan[0]];

  return (
    <div className="space-y-4" data-testid="pasien-beranda">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Halo, {p.nama.split(" ")[0]} ❤️</h1>
        <p className="text-sm text-slate-500">Kehamilan Ibu saat ini</p>
      </div>

      <div className={`${card} !bg-[#C02650] !border-[#C02650] text-white`} data-testid="beranda-kehamilan-card">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-3xl font-extrabold tracking-tight">{usiaLabel(p)}</div>
            <div className="text-white/80 text-xs font-semibold mt-1">{FASE_LABEL[p.fase]}</div>
          </div>
          {countdown != null && countdown >= 0 && (
            <div className="text-right">
              <div className="text-2xl font-extrabold">{countdown}</div>
              <div className="text-white/80 text-[11px] font-semibold">hari menuju HPL</div>
            </div>
          )}
        </div>
        <div className="h-3 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-white/80 text-[11px] font-semibold mt-2 flex justify-between">
          <span>{progress}% perjalanan</span>
          <span>HPL: {fmtDate(p.hpl)}</span>
        </div>
      </div>

      {p.jadwal_berikutnya && p.selisih_hari != null && p.selisih_hari <= 7 && (
        <Link to="/ibu/perjalanan" data-testid="beranda-pengingat-kontrol" className={`flex items-center gap-3 ${card} !py-4 ${p.selisih_hari < 0 ? "!border-red-300 !bg-red-50" : "!border-amber-200 !bg-amber-50"}`}>
          <CalendarClock className={`w-6 h-6 shrink-0 ${p.selisih_hari < 0 ? "text-red-600" : "text-amber-600"}`} />
          <div className="text-sm">
            <b>{p.selisih_hari < 0 ? `Kontrol terlambat ${-p.selisih_hari} hari!` : p.selisih_hari === 0 ? "Jadwal kontrol HARI INI" : `Kontrol ${p.selisih_hari} hari lagi`}</b>
            <div className="text-xs text-slate-500">{p.kunjungan_berikutnya} · {fmtDate(p.jadwal_berikutnya)}</div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { to: "/ibu/pantau", icon: Activity, label: "Pantau", testid: "qa-pantau" },
          { to: "/ibu/ttd", icon: Pill, label: "TTD/MMS", testid: "qa-ttd" },
          { to: "/ibu/gerakan", icon: Baby, label: "Gerakan", testid: "qa-gerakan" },
          { to: "/ibu/bahaya", icon: AlertTriangle, label: "Bahaya", testid: "qa-bahaya" },
        ].map(({ to, icon: Icon, label, testid }) => (
          <Link key={to} to={to} data-testid={testid} className="flex flex-col items-center gap-1.5 bg-white rounded-2xl border border-slate-200/80 py-4 active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-2xl bg-[#FDF2F5] flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#C02650]" />
            </div>
            <span className="text-[11px] font-bold text-slate-700">{label}</span>
          </Link>
        ))}
      </div>

      <div className={card} data-testid="beranda-todo">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Yang perlu Ibu lakukan hari ini</h2>
        <div className="space-y-2.5">
          {todos.map((t) => (
            <Link key={t.label} to={t.to} className="flex items-center gap-3 text-sm">
              {t.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
              <span className={t.done ? "text-slate-400 line-through" : "text-slate-700 font-semibold"}>{t.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <Link to="/ibu/janji" data-testid="beranda-janji-link" className={`flex items-center gap-3 ${card} !py-4`}>
        <div className="w-10 h-10 rounded-2xl bg-[#E8F8EE] flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5 text-[#128C4A]" />
        </div>
        <div className="text-sm">
          <b className="text-slate-900">Buat Janji Kontrol</b>
          <div className="text-xs text-slate-500">Hubungi bidan via WhatsApp, sekali klik</div>
        </div>
      </Link>

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-900 mb-1">Edukasi untuk Ibu</h2>
        <p className="text-xs text-[#C02650] font-semibold mb-3">{BERANDA_EDUKASI_TRIMESTER[p.fase]}</p>
        <div className="space-y-3">
          {artikel.map((a) => (
            <div key={a.judul} className="border border-slate-100 rounded-2xl p-3.5">
              <div className="text-sm font-bold text-slate-800 mb-1">{a.judul}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{a.isi}</div>
            </div>
          ))}
        </div>
        <Link to="/ibu/edukasi" data-testid="beranda-edukasi-link" className="block text-center text-xs font-bold text-[#C02650] mt-3 hover:underline">
          Lihat semua edukasi →
        </Link>
      </div>
    </div>
  );
}
