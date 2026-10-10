import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Baby, ClipboardList, Pill } from "lucide-react";
import api from "../lib/api";
import { fmtDate } from "../lib/utils-id";

const cardCls = "bg-white rounded-xl border border-slate-200/80 p-5";

export default function PemantauanPasien({ patientId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/patients/${patientId}/pemantauan`).then((r) => setData(r.data)).catch(() => setData({ harian: [], mingguan: [], ttd: [], gerakan: [] }));
  }, [patientId]);

  if (!data) return null;

  const kosong = !data.harian.length && !data.mingguan.length && !data.ttd.length && !data.gerakan.length;
  const ttdSudah = data.ttd.filter((t) => t.status === "sudah").length;
  const kepatuhan = data.ttd.length ? Math.round((ttdSudah / data.ttd.length) * 100) : null;

  return (
    <div className="mb-6" data-testid="pemantauan-pasien-panel">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-[#C02650]" />
        <h2 className="text-base font-bold text-slate-900">Pemantauan Mandiri Pasien (Portal)</h2>
      </div>

      {kosong ? (
        <div className={`${cardCls} text-center text-sm text-slate-400`} data-testid="pemantauan-empty">
          Pasien belum pernah mengisi pemantauan dari portal.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cardCls}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Pemantauan Harian Terbaru</h3>
            {data.harian.length === 0 ? (
              <div className="text-xs text-slate-400">Belum ada data.</div>
            ) : (
              <div className="space-y-2">
                {data.harian.slice(0, 7).map((h) => (
                  <div key={h.tanggal} className={`px-3.5 py-2.5 rounded-xl border text-xs ${h.tanda_bahaya?.length ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-100"}`} data-testid={`pantau-harian-${h.tanggal}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{fmtDate(h.tanggal)}</span>
                      <span className="font-semibold text-slate-500">{h.kondisi}</span>
                    </div>
                    {h.tanda_bahaya?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-red-700 font-bold">
                        <AlertTriangle className="w-3 h-3" /> {h.tanda_bahaya.join(", ")}
                      </div>
                    )}
                    {h.keluhan_lain && <div className="text-slate-400 mt-1 truncate">{h.keluhan_lain}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cardCls}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-[#C02650]" /> Kepatuhan TTD/MMS (30 catatan terakhir)
            </h3>
            {data.ttd.length === 0 ? (
              <div className="text-xs text-slate-400">Belum ada data.</div>
            ) : (
              <>
                <div className="text-2xl font-extrabold text-slate-900 mb-2" data-testid="pantau-ttd-kepatuhan">
                  {kepatuhan}% <span className="text-xs font-semibold text-slate-400">({ttdSudah}/{data.ttd.length} hari minum)</span>
                </div>
                <div className="space-y-1.5">
                  {data.ttd.slice(0, 5).map((t) => (
                    <div key={t.tanggal} className="flex items-center justify-between text-xs" data-testid={`pantau-ttd-${t.tanggal}`}>
                      <span className="text-slate-600">{fmtDate(t.tanggal)}</span>
                      <span className={`font-bold ${t.status === "sudah" ? "text-emerald-600" : "text-red-600"}`}>
                        {t.status === "sudah" ? "Minum" : `Tidak${t.alasan ? ` — ${t.alasan}` : ""}`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={cardCls}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-[#C02650]" /> Pemantauan Mingguan
            </h3>
            {data.mingguan.length === 0 ? (
              <div className="text-xs text-slate-400">Belum ada data.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.mingguan.map((m) => (
                  <span
                    key={m.minggu_ke}
                    data-testid={`pantau-mingguan-${m.minggu_ke}`}
                    className={`px-2.5 py-1.5 rounded-full text-xs font-bold border ${m.ada_bahaya ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                  >
                    Minggu {m.minggu_ke} {m.ada_bahaya ? "⚠ ada keluhan" : "✓ aman"}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={cardCls}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Baby className="w-3.5 h-3.5 text-[#C02650]" /> Gerakan Bayi (14 hari terakhir)
            </h3>
            {data.gerakan.length === 0 ? (
              <div className="text-xs text-slate-400">Belum ada data.</div>
            ) : (
              <div className="space-y-1.5">
                {data.gerakan.slice(0, 7).map((g) => (
                  <div key={g.tanggal} className="flex items-center justify-between text-xs" data-testid={`pantau-gerakan-${g.tanggal}`}>
                    <span className="text-slate-600">{fmtDate(g.tanggal)}</span>
                    <span className={`font-bold ${(g.jumlah || 0) >= 10 ? "text-emerald-600" : "text-amber-600"}`}>{g.jumlah || 0}x gerakan</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
