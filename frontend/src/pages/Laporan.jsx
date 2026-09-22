import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, UserX, AlertTriangle } from "lucide-react";
import api from "../lib/api";

const cardCls = "bg-white rounded-xl border border-slate-200/80 p-5";

function Bar({ label, done, eligible, persen, testid }) {
  return (
    <div data-testid={testid}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">
          {done}/{eligible} {persen != null && <b className={persen >= 80 ? "text-emerald-600" : persen >= 50 ? "text-amber-600" : "text-red-600"}>({persen}%)</b>}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${persen >= 80 ? "bg-emerald-500" : persen >= 50 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${persen ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export default function Laporan() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/laporan").then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="text-sm text-slate-400 animate-pulse" data-testid="laporan-loading">Memuat laporan...</div>;

  const stats = [
    { label: "Total Pasien", value: data.total, icon: BarChart3, cls: "bg-slate-900 text-white", testid: "laporan-total" },
    { label: "Kontrol Tuntas", value: `${data.tuntas} (${data.tuntas_persen}%)`, icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600", testid: "laporan-tuntas" },
    { label: "Lost to Follow Up", value: `${data.lost} (${data.lost_persen}%)`, icon: UserX, cls: "bg-red-50 text-red-600", testid: "laporan-lost" },
  ];

  return (
    <div data-testid="laporan-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-[#C02650] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Laporan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tingkat ketuntasan kontrol dan profil risiko pasien.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, cls, testid }) => (
          <div key={label} className={cardCls} data-testid={testid}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${cls}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Ketuntasan ANC per Kunjungan</h3>
          <div className="space-y-4">
            {data.anc.map((s) => (
              <Bar key={s.kode} label={s.label} done={s.done} eligible={s.eligible} persen={s.persen} testid={`laporan-${s.kode}`} />
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-4">% = pasien yang menyelesaikan kunjungan dari yang seharusnya sudah menjalaninya (target terlewati / sudah bersalin).</p>
        </div>
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Ketuntasan PNC (Nifas) per Kunjungan</h3>
          {data.pnc.every((s) => s.eligible === 0) ? (
            <div className="text-xs text-slate-400 py-8 text-center" data-testid="laporan-pnc-empty">Belum ada pasien nifas yang melewati jadwal KF.</div>
          ) : (
            <div className="space-y-4">
              {data.pnc.map((s) => (
                <Bar key={s.kode} label={s.label} done={s.done} eligible={s.eligible} persen={s.persen} testid={`laporan-${s.kode}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Penyakit Penyerta Pasien</h3>
          {data.penyakit.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">Belum ada data penyakit penyerta.</div>
          ) : (
            <div className="space-y-3">
              {data.penyakit.map((s) => (
                <Bar key={s.nama} label={s.nama} done={s.jumlah} eligible={data.total} persen={s.persen} testid={`laporan-penyakit-${s.nama}`} />
              ))}
            </div>
          )}
        </div>
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Penyulit Kehamilan & Persalinan Tertinggi
          </h3>
          {data.penyulit.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">Belum ada data penyulit.</div>
          ) : (
            <div className="space-y-3">
              {data.penyulit.map((s) => (
                <Bar key={s.nama} label={s.nama} done={s.jumlah} eligible={data.total} persen={s.persen} testid={`laporan-penyulit`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
