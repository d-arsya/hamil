import { useEffect, useMemo, useState } from "react";
import { Pill, Flame } from "lucide-react";
import { toast } from "sonner";
import pasienApi, { pasienError } from "../../lib/pasienApi";
import { TTD_TIPS, TTD_ALASAN } from "../../lib/konten";
import { fmtDate } from "../../lib/utils-id";

export default function TTD() {
  const [records, setRecords] = useState(null);
  const [alasan, setAlasan] = useState("");
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7));
  const [editTgl, setEditTgl] = useState(null);
  const [editAlasan, setEditAlasan] = useState("");
  const [editCustom, setEditCustom] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const load = () => pasienApi.get("/pasien/ttd").then((r) => setRecords(r.data));
  useEffect(() => { load(); }, []);

  const byDate = useMemo(() => Object.fromEntries((records || []).map((r) => [r.tanggal, r])), [records]);
  const todayRec = byDate[today];

  const tandai = async (status) => {
    if (status === "tidak" && !alasan) {
      toast.error("Pilih alasan dulu ya, Bu");
      return;
    }
    try {
      await pasienApi.post("/pasien/ttd", { status, alasan: status === "tidak" ? alasan : "" });
      toast.success(status === "sudah" ? "Bagus, Bu! TTD/MMS hari ini tercatat" : "Tercatat. Jangan lupa besok ya, Bu");
      setAlasan("");
      load();
    } catch (err) {
      toast.error(pasienError(err));
    }
  };

  const simpanEdit = async (status) => {
    const al = editCustom.trim() || editAlasan;
    if (!al) {
      toast.error("Isi alasan kenapa terlewat dulu ya, Bu");
      return;
    }
    try {
      await pasienApi.post("/pasien/ttd", { tanggal: editTgl, status, alasan: al });
      toast.success("Catatan tanggal terlewat tersimpan");
      setEditTgl(null);
      load();
    } catch (err) {
      toast.error(pasienError(err));
    }
  };

  const monthDays = useMemo(() => {
    const [y, m] = bulan.split("-").map(Number);
    const n = new Date(y, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${bulan}-${String(i + 1).padStart(2, "0")}`);
  }, [bulan]);

  const monthRecs = monthDays.map((d) => byDate[d]).filter(Boolean);
  const sudah = monthRecs.filter((r) => r.status === "sudah").length;
  const tidak = monthRecs.filter((r) => r.status === "tidak").length;
  const kepatuhan = monthRecs.length ? Math.round((sudah / monthRecs.length) * 100) : 0;
  const streak = useMemo(() => {
    let s = 0;
    const d = new Date();
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (byDate[key]?.status === "sudah") { s++; d.setDate(d.getDate() - 1); } else break;
    }
    return s;
  }, [byDate]);

  if (!records) return <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>;

  return (
    <div className="space-y-4" data-testid="ttd-page">
      <h1 className="text-xl font-extrabold text-slate-900">TTD / MMS Saya</h1>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-5">
        <div className="text-sm font-bold text-slate-900 mb-3">Sudah minum hari ini?</div>
        {todayRec ? (
          <div className={`text-center py-3 rounded-2xl text-sm font-bold ${todayRec.status === "sudah" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`} data-testid="ttd-today-status">
            {todayRec.status === "sudah" ? "✓ Sudah minum hari ini" : `× Belum minum (${todayRec.alasan || "-"})`}
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <button data-testid="ttd-sudah" onClick={() => tandai("sudah")} className="flex-1 py-4 rounded-2xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 active:scale-95 transition-transform">SUDAH</button>
              <button data-testid="ttd-belum" onClick={() => tandai("tidak")} className="flex-1 py-4 rounded-2xl text-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 active:scale-95 transition-transform">BELUM</button>
            </div>
            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-600 mb-1.5">Kenapa belum minum?</div>
              <div className="flex flex-wrap gap-2">
                {TTD_ALASAN.map((a) => (
                  <button key={a} data-testid={`ttd-alasan-${a}`} onClick={() => setAlasan(a)}
                    className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${alasan === a ? "bg-[#FDF2F5] text-[#C02650] border-[#C02650]/40" : "bg-white text-slate-500 border-slate-200"}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-5" data-testid="ttd-calendar">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-slate-900">Kalender {new Date(bulan + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</div>
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1" data-testid="ttd-month-picker" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {monthDays.map((d) => {
            const r = byDate[d];
            const cls = `aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-bold ${
              r?.status === "sudah" ? "bg-emerald-100 text-emerald-700" : r?.status === "tidak" ? "bg-red-100 text-red-600" : "bg-slate-50 text-slate-400"
            }`;
            const inner = (
              <>
                {Number(d.slice(-2))}
                <span>{r?.status === "sudah" ? "✓" : r?.status === "tidak" ? "×" : "○"}</span>
              </>
            );
            if (d < today) {
              return (
                <button
                  key={d}
                  data-testid={`ttd-day-${d}`}
                  onClick={() => { setEditTgl(d); setEditAlasan(r?.alasan || ""); setEditCustom(""); }}
                  className={`${cls} active:scale-90 transition-transform`}
                >
                  {inner}
                </button>
              );
            }
            return <div key={d} className={`${cls} ${d > today ? "opacity-40" : ""}`}>{inner}</div>;
          })}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Ketuk tanggal yang sudah lewat untuk mengisi/mengubah catatan — wajib isi alasan kenapa terlewat.</p>
      </div>

      <div className="grid grid-cols-4 gap-2" data-testid="ttd-stats">
        {[
          [`${sudah}`, "hari minum"],
          [`${tidak}`, "terlewat"],
          [`${kepatuhan}%`, "kepatuhan"],
          [`${streak}`, "hari beruntun"],
        ].map(([v, l]) => (
          <div key={l} className="bg-white rounded-2xl border border-slate-200/80 p-3 text-center">
            <div className="text-lg font-extrabold text-slate-900 flex items-center justify-center gap-1">{l === "hari beruntun" && streak > 0 && <Flame className="w-4 h-4 text-orange-500" />}{v}</div>
            <div className="text-[10px] font-semibold text-slate-400">{l}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Pill className="w-4 h-4 text-[#C02650]" />
          <div className="text-sm font-bold text-slate-900">Tahukah Ibu?</div>
        </div>
        <ul className="space-y-1.5">
          {TTD_TIPS.map((t) => <li key={t} className="text-xs text-slate-500 leading-relaxed">• {t}</li>)}
        </ul>
      </div>

      {editTgl && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/40 px-4 pb-4 sm:pb-0" onClick={() => setEditTgl(null)} data-testid="ttd-edit-modal">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold text-slate-900">Isi TTD/MMS — {fmtDate(editTgl)}</div>
            <p className="text-xs text-slate-500">Tanggal ini sudah terlewat. Wajib isi alasan kenapa lupa mengisi ya, Bu.</p>
            <div className="flex gap-2">
              <button data-testid="ttd-edit-sudah" onClick={() => simpanEdit("sudah")} className="flex-1 py-3 rounded-2xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 active:scale-95 transition-transform">SUDAH minum</button>
              <button data-testid="ttd-edit-tidak" onClick={() => simpanEdit("tidak")} className="flex-1 py-3 rounded-2xl text-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 active:scale-95 transition-transform">TIDAK minum</button>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1.5">Alasan kenapa terlewat (wajib)</div>
              <div className="flex flex-wrap gap-2">
                {TTD_ALASAN.map((a) => (
                  <button
                    key={a}
                    data-testid={`ttd-edit-alasan-${a}`}
                    onClick={() => { setEditAlasan(a); setEditCustom(""); }}
                    className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${editAlasan === a && !editCustom ? "bg-[#FDF2F5] text-[#C02650] border-[#C02650]/40" : "bg-white text-slate-500 border-slate-200"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <input
                data-testid="ttd-edit-alasan-custom"
                value={editCustom}
                onChange={(e) => { setEditCustom(e.target.value); setEditAlasan(""); }}
                placeholder="Atau tulis alasan lain..."
                className="mt-2 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650]"
              />
            </div>
            <button data-testid="ttd-edit-batal" onClick={() => setEditTgl(null)} className="w-full py-2 text-xs font-bold text-slate-400">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}
