import { useEffect, useState } from "react";
import { ShieldCheck, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { fmtDate } from "../lib/utils-id";

const STATUS_CLS = {
  selesai: ["Selesai", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  terlambat: ["Terlambat", "bg-red-100 text-red-700 border-red-300"],
  hari_ini: ["Hari Ini", "bg-rose-50 text-rose-700 border-rose-200"],
  mendekati: ["Mendekati", "bg-amber-50 text-amber-700 border-amber-200"],
  terjadwal: ["Terjadwal", "bg-slate-50 text-slate-600 border-slate-200"],
  menunggu: ["Menunggu Dosis Sebelumnya", "bg-slate-50 text-slate-400 border-slate-200"],
};

export default function ImunisasiTTPanel({ patient }) {
  const [data, setData] = useState(null);

  const load = () => api.get(`/patients/${patient.id}/imunisasi-tt`).then((r) => setData(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  if (!data) return null;

  const tandai = async (kode) => {
    try {
      await api.post(`/patients/${patient.id}/imunisasi-tt`, { kode });
      toast.success("Imunisasi TT ditandai selesai");
      load();
    } catch (err) {
      toast.error(apiError(err, "Gagal menandai imunisasi TT"));
    }
  };

  const hapus = async (rid) => {
    if (!window.confirm("Hapus tanda imunisasi TT ini?")) return;
    await api.delete(`/imunisasi-tt/${rid}`);
    toast.success("Tanda imunisasi TT dihapus");
    load();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 mb-6" data-testid="imunisasi-tt-panel">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Checklist Imunisasi TT (Ibu Hamil)</h2>
          <p className="text-[11px] text-slate-400">Jadwal TT1–TT5 sesuai anjuran Kemenkes — interval dihitung dari tanggal dosis sebelumnya.</p>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {data.items.map((it) => {
          const [label, cls] = STATUS_CLS[it.status];
          return (
            <div key={it.kode} className="flex flex-wrap items-center gap-3 px-5 py-3" data-testid={`imunisasi-tt-row-${it.kode}`}>
              <div className="flex-1 min-w-[220px]">
                <div className="text-sm font-semibold text-slate-800">{it.nama}</div>
                <div className="text-xs text-slate-400">
                  {it.ket}
                  {it.tanggal_target && ` · target ${fmtDate(it.tanggal_target)}`}
                  {it.record && <span className="text-emerald-600 font-semibold"> · diberikan {fmtDate(it.record.tanggal)}</span>}
                </div>
              </div>
              <span data-testid={`imunisasi-tt-status-${it.kode}`} className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
                {label}
              </span>
              {it.record ? (
                <button
                  data-testid={`imunisasi-tt-delete-${it.kode}`}
                  onClick={() => hapus(it.record.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Hapus tanda"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  data-testid={`imunisasi-tt-done-${it.kode}`}
                  onClick={() => tandai(it.kode)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Tandai Selesai
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
