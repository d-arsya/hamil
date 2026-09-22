import { useEffect, useState } from "react";
import { Syringe, MessageCircle, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { fmtDate } from "../lib/utils-id";

const STATUS_CLS = {
  selesai: ["Selesai", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  terlambat: ["Terlambat", "bg-red-100 text-red-700 border-red-300"],
  hari_ini: ["Hari Ini", "bg-rose-50 text-rose-700 border-rose-200"],
  mendekati: ["Mendekati", "bg-amber-50 text-amber-700 border-amber-200"],
  terjadwal: ["Terjadwal", "bg-slate-50 text-slate-600 border-slate-200"],
};

export default function ImunisasiPanel({ patient, onRemind }) {
  const [data, setData] = useState(null);

  const load = () => api.get(`/patients/${patient.id}/imunisasi`).then((r) => setData(r.data));
  useEffect(() => {
    if (patient.tanggal_persalinan) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id, patient.tanggal_persalinan]);

  if (!patient.tanggal_persalinan || !data) return null;

  const tandai = async (kode) => {
    try {
      await api.post(`/patients/${patient.id}/imunisasi`, { kode });
      toast.success("Imunisasi ditandai selesai");
      load();
    } catch (err) {
      toast.error(apiError(err, "Gagal menandai imunisasi"));
    }
  };

  const hapus = async (rid) => {
    if (!window.confirm("Hapus tanda imunisasi ini?")) return;
    await api.delete(`/imunisasi/${rid}`);
    toast.success("Tanda imunisasi dihapus");
    load();
  };

  const anak = patient.nama_anak || `anak dari Ibu ${patient.nama}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 mb-6" data-testid="imunisasi-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
            <Syringe className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Checklist Imunisasi Bayi</h2>
            <p className="text-[11px] text-slate-400">
              {anak} · usia {data.usia_bayi_hari ?? 0} hari · jadwal mengacu IDAI Edisi 7 (2024)
            </p>
          </div>
        </div>
        <button
          data-testid="imunisasi-remind-button"
          onClick={onRemind}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#25D366]/10 text-[#128C4A] border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Ingatkan WA
        </button>
      </div>
      <div className="divide-y divide-slate-50">
        {data.items.map((it) => {
          const [label, cls] = STATUS_CLS[it.status];
          return (
            <div key={it.kode} className="flex flex-wrap items-center gap-3 px-5 py-3" data-testid={`imunisasi-row-${it.kode}`}>
              <div className="flex-1 min-w-[220px]">
                <div className="text-sm font-semibold text-slate-800">{it.nama}</div>
                <div className="text-xs text-slate-400">
                  usia {it.usia} · target {fmtDate(it.tanggal_target)}
                  {it.record && <span className="text-emerald-600 font-semibold"> · diberikan {fmtDate(it.record.tanggal)}</span>}
                </div>
              </div>
              <span data-testid={`imunisasi-status-${it.kode}`} className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
                {label}
              </span>
              {it.record ? (
                <button
                  data-testid={`imunisasi-delete-${it.kode}`}
                  onClick={() => hapus(it.record.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Hapus tanda"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  data-testid={`imunisasi-done-${it.kode}`}
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
