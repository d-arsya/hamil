import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import pasienApi, { pasienError } from "../../lib/pasienApi";
import { usePasien } from "./PasienLayout";
import { MINGGUAN_CHECKLIST } from "../../lib/konten";

export default function Mingguan() {
  const { me } = usePasien();
  const p = me.pasien;
  const items = MINGGUAN_CHECKLIST[p.fase] || MINGGUAN_CHECKLIST.trimester_1;
  const mingguKe = p.usia_minggu ?? (p.hari_nifas != null ? 40 + Math.floor(p.hari_nifas / 7) : 0);

  const [jawaban, setJawaban] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const pilih = (item, val) => setJawaban((j) => ({ ...j, [item]: val }));

  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await pasienApi.post("/pasien/mingguan", { minggu_ke: mingguKe, jawaban });
      setResult(data.ada_bahaya);
    } catch (err) {
      toast.error(pasienError(err));
    } finally {
      setSaving(false);
    }
  };

  if (result !== null) {
    return (
      <div className="space-y-4 pt-6" data-testid="mingguan-saved">
        <div className="bg-white rounded-3xl border border-emerald-200 p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-lg font-extrabold text-slate-900">Pemantauan mingguan tersimpan</h1>
        </div>
        {result && (
          <div className="bg-red-50 rounded-3xl border border-red-200 p-5" data-testid="mingguan-warning">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <b className="text-sm text-red-700">Perlu perhatian</b>
            </div>
            <p className="text-sm text-red-700 leading-relaxed">
              Keluhan ini termasuk tanda yang perlu diperhatikan dalam kehamilan. Jangan menunggu sampai keluhan memburuk. Segera periksa ke fasilitas pelayanan kesehatan.
            </p>
          </div>
        )}
        <button onClick={() => setResult(null)} data-testid="mingguan-edit" className="w-full py-3.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600">Ubah jawaban</button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="mingguan-page">
      <h1 className="text-xl font-extrabold text-slate-900">Pemantauan Mingguan</h1>
      <p className="text-xs text-slate-500 mb-2">Minggu ke-{mingguKe} · Jawab jujur ya, Bu — checklist dari Buku KIA.</p>
      {items.map((item, i) => (
        <div key={item} className="bg-white rounded-2xl border border-slate-200/80 p-4" data-testid={`mingguan-item-${i}`}>
          <div className="text-sm font-semibold text-slate-800 mb-2.5">{item}</div>
          <div className="flex gap-2">
            {[["Tidak", false], ["Ya", true]].map(([label, val]) => (
              <button
                key={label}
                type="button"
                data-testid={`mingguan-${i}-${label.toLowerCase()}`}
                onClick={() => pilih(item, val)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
                  jawaban[item] === val ? (val ? "bg-red-50 text-red-700 border-red-300" : "bg-emerald-50 text-emerald-700 border-emerald-300") : "bg-white text-slate-500 border-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={submit} data-testid="mingguan-submit" disabled={saving || Object.keys(jawaban).length < items.length}
        className="w-full py-4 rounded-2xl text-base font-bold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60">
        {saving ? "Menyimpan..." : "SIMPAN PEMANTAUAN MINGGUAN"}
      </button>
      {Object.keys(jawaban).length < items.length && <p className="text-[11px] text-slate-400 text-center">Jawab semua pertanyaan dulu ya, Bu.</p>}
    </div>
  );
}
