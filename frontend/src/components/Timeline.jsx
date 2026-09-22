import { CheckCircle2, Circle } from "lucide-react";
import { fmtDate } from "../lib/utils-id";

const FASE_LABEL = {
  trimester_1: "Trimester 1",
  trimester_2: "Trimester 2",
  trimester_3: "Trimester 3",
  nifas: "Masa Nifas",
};
const ORDER = ["trimester_1", "trimester_2", "trimester_3", "nifas"];

export default function Timeline({ timeline }) {
  if (!timeline?.items?.length) return null;
  const { items, ringkasan } = timeline;
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 mb-6" data-testid="timeline-card">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-5">Timeline Kunjungan</h3>
      <div className="space-y-6">
        {ORDER.map((fase) => {
          const group = items.filter((i) => i.fase === fase);
          if (!group.length) return null;
          const r = ringkasan[fase];
          return (
            <div key={fase} data-testid={`timeline-group-${fase}`}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-bold text-slate-800">{FASE_LABEL[fase]}</span>
                {r && (
                  <span
                    data-testid={`timeline-summary-${fase}`}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      r.lengkap ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {r.lengkap ? `Lengkap ${r.ke}/${r.total}` : `Tidak lengkap ${r.ke}/${r.total}`}
                  </span>
                )}
              </div>
              <div className="relative pl-7 space-y-3 before:content-[''] before:absolute before:left-[9px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-slate-200">
                {group.map((it) => (
                  <div key={it.kode} className="relative flex flex-wrap items-center gap-x-2 gap-y-0.5" data-testid={`timeline-item-${it.kode}`}>
                    <span className="absolute -left-7 top-0">
                      {it.selesai ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 bg-white rounded-full" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 bg-white rounded-full" />
                      )}
                    </span>
                    <span className="text-sm font-bold text-slate-800 w-11">{it.kode}</span>
                    <span className="text-xs text-slate-500">
                      {it.minggu != null ? `minggu ke-${it.minggu}` : `hari ke-${it.hari}`} · target {fmtDate(it.target)}
                    </span>
                    {it.selesai ? (
                      <span className="text-xs font-semibold text-emerald-700">tercapai {fmtDate(it.tanggal)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">belum kontrol</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
