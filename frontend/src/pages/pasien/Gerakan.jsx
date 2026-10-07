import { useEffect, useState } from "react";
import { Baby, Plus, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import pasienApi from "../../lib/pasienApi";
import { usePasien } from "./PasienLayout";
import { fmtDate } from "../../lib/utils-id";

export default function Gerakan() {
  const { me } = usePasien();
  const p = me.pasien;
  const [records, setRecords] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = () => pasienApi.get("/pasien/gerakan").then((r) => setRecords(r.data));
  useEffect(() => { load(); }, []);

  const minggu = p.usia_minggu ?? 0;
  const tersedia = minggu >= 24 && p.fase !== "nifas";

  if (!tersedia) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 text-center" data-testid="gerakan-locked">
        <Baby className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h1 className="text-lg font-extrabold text-slate-900 mb-2">Pantau Gerakan Bayi</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          {p.fase === "nifas"
            ? "Fitur ini untuk masa kehamilan. Bayi Ibu sudah lahir — selamat ya, Bu!"
            : `Fitur ini tersedia setelah usia kehamilan 24 minggu. Kehamilan Ibu saat ini ${minggu} minggu.`}
        </p>
      </div>
    );
  }

  if (!records) return <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>;

  const todayCount = records.find((r) => r.tanggal === today)?.jumlah || 0;
  const tambah = async () => {
    await pasienApi.post("/pasien/gerakan");
    load();
  };

  const chartData = [...records].reverse().slice(-14).map((r) => ({ tanggal: r.tanggal.slice(5), jumlah: r.jumlah }));

  return (
    <div className="space-y-4" data-testid="gerakan-page">
      <h1 className="text-xl font-extrabold text-slate-900">Pantau Gerakan Bayi</h1>
      <p className="text-xs text-slate-500">Setelah usia kehamilan 24 minggu, perhatikan gerakan bayi setiap hari.</p>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
        <div className="text-xs font-semibold text-slate-400 mb-1">Gerakan bayi dalam 12 jam</div>
        <div className="text-5xl font-extrabold text-slate-900 mb-1" data-testid="gerakan-count">{todayCount}</div>
        <div className="text-xs text-slate-400 mb-4">kali hari ini · target ≥10 gerakan</div>
        <button
          data-testid="gerakan-add"
          onClick={tambah}
          className="w-24 h-24 rounded-full bg-[#C02650] text-white flex flex-col items-center justify-center gap-1 mx-auto active:scale-90 transition-transform shadow-lg shadow-rose-200"
        >
          <Plus className="w-8 h-8" />
          <span className="text-[10px] font-bold">GERAKAN</span>
        </button>
        <p className="text-[11px] text-slate-400 mt-3">Tekan setiap kali Ibu merasakan gerakan</p>
      </div>

      {todayCount === 0 ? (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-4 flex gap-2.5" data-testid="gerakan-warning-none">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-xs text-red-700 leading-relaxed">Gerakan bayi belum tercatat hari ini. Jika gerakan bayi tidak terasa, segera periksa ke fasilitas pelayanan kesehatan.</p>
        </div>
      ) : todayCount < 10 ? (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex gap-2.5" data-testid="gerakan-warning-low">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">Gerakan bayi lebih sedikit dari yang diharapkan (kurang dari 10 dalam 12 jam). Segera periksa ke fasilitas pelayanan kesehatan.</p>
        </div>
      ) : (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 text-xs font-semibold text-emerald-700" data-testid="gerakan-ok">
          Bagus, Bu! Gerakan bayi hari ini sudah memenuhi target.
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5" data-testid="gerakan-chart">
          <div className="text-sm font-bold text-slate-900 mb-3">Riwayat 14 hari terakhir</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <XAxis dataKey="tanggal" fontSize={9} tickLine={false} />
              <YAxis fontSize={9} tickLine={false} axisLine={false} width={24} />
              <Tooltip />
              <Bar dataKey="jumlah" fill="#C02650" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
