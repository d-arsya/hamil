import { CheckCircle2, Circle, CalendarClock } from "lucide-react";
import { usePasien } from "./PasienLayout";
import { fmtDate } from "../../lib/utils-id";
import { FASE_LABEL } from "../../lib/konten";

const ORDER = ["trimester_1", "trimester_2", "trimester_3", "nifas"];
const FASE_DESC = {
  trimester_1: "Awal kehamilan — organ bayi mulai terbentuk. Perbanyak istirahat dan minum asam folat.",
  trimester_2: "Bayi mulai bergerak. Perhatikan nutrisi dan mulai persiapkan persalinan.",
  trimester_3: "Bayi tumbuh cepat. Kenali tanda persalinan dan pantau gerakan bayi setiap hari.",
  nifas: "Masa pemulihan setelah melahirkan. Jaga kesehatan Ibu dan pantau tumbuh kembang bayi.",
};

export default function Perjalanan() {
  const { me } = usePasien();
  const { timeline, pasien: p } = me;

  return (
    <div className="space-y-4" data-testid="perjalanan-page">
      <h1 className="text-xl font-extrabold text-slate-900">Perjalanan Kehamilan</h1>

      {p.jadwal_berikutnya && (
        <div className="bg-[#C02650] rounded-3xl p-5 text-white" data-testid="perjalanan-next">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="w-5 h-5" />
            <span className="text-sm font-bold">Kontrol berikutnya</span>
          </div>
          <div className="text-2xl font-extrabold">{fmtDate(p.jadwal_berikutnya)}</div>
          <div className="text-white/80 text-xs font-semibold">Kunjungan {p.kunjungan_berikutnya}</div>
        </div>
      )}

      {ORDER.map((fase) => {
        const group = timeline.items.filter((i) => i.fase === fase);
        if (!group.length) return null;
        const r = timeline.ringkasan[fase];
        return (
          <div key={fase} className="bg-white rounded-3xl border border-slate-200/80 p-5" data-testid={`perjalanan-${fase}`}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-extrabold text-slate-900">{FASE_LABEL[fase]}</h2>
              {r && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${r.lengkap ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {r.ke}/{r.total} kontrol
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">{FASE_DESC[fase]}</p>
            <div className="relative pl-7 space-y-3 before:content-[''] before:absolute before:left-[9px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-slate-100">
              {group.map((it) => (
                <div key={it.kode} className="relative" data-testid={`perjalanan-item-${it.kode}`}>
                  <span className="absolute -left-7 top-0">
                    {it.selesai ? <CheckCircle2 className="w-5 h-5 text-emerald-600 bg-white rounded-full" /> : <Circle className="w-5 h-5 text-slate-300 bg-white rounded-full" />}
                  </span>
                  <div className="text-sm font-bold text-slate-800">
                    Kunjungan {it.kode} <span className="font-normal text-slate-400 text-xs">({it.minggu != null ? `minggu ke-${it.minggu}` : `hari ke-${it.hari}`})</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {it.selesai ? `Sudah diperiksa ${fmtDate(it.tanggal)} ❤️` : `Dijadwalkan sekitar ${fmtDate(it.target)}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-slate-400 text-center">Data ini dicatat oleh bidan Ibu dan selalu sinkron dengan catatan klinik.</p>
    </div>
  );
}
