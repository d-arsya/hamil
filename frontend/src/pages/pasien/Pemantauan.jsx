import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import pasienApi, { pasienError } from "../../lib/pasienApi";
import { toast } from "sonner";

function RadioYN({ label, value, onChange, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
      <div className="text-sm font-semibold text-slate-800 mb-2.5">{label}</div>
      <div className="flex gap-2">
        {["Tidak", "Ya"].map((v) => (
          <button
            key={v}
            type="button"
            data-testid={`${testid}-${v.toLowerCase()}`}
            onClick={() => onChange(v)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
              value === v ? (v === "Ya" ? "bg-red-50 text-red-700 border-red-300" : "bg-emerald-50 text-emerald-700 border-emerald-300") : "bg-white text-slate-500 border-slate-200"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Pemantauan() {
  const [f, setF] = useState({
    kondisi: "Baik", demam: "Tidak", suhu: "", demam_hari: "", sakit_kepala: "Tidak", nyeri_perut: "Tidak",
    perdarahan: "Tidak", cairan: "Tidak", cairan_banyak: "Tidak", sakit_bak: "Tidak", keputihan: "Tidak",
    mual: "Tidak", mual_tingkat: "", diare: "Tidak", sesak: "Tidak", emosional: "Biasa saja", sulit_tidur: "Tidak", keluhan_lain: "",
  });
  const [done, setDone] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await pasienApi.post("/pasien/pemantauan", {
        ...f,
        suhu: f.suhu ? Number(f.suhu) : null,
        demam_hari: f.demam_hari ? Number(f.demam_hari) : null,
        mual_tingkat: f.mual === "Ya" ? f.mual_tingkat || "Ringan" : null,
      });
      setDone(data.tanda_bahaya);
    } catch (err) {
      toast.error(pasienError(err));
    } finally {
      setSaving(false);
    }
  };

  if (done !== null) {
    return (
      <div className="space-y-4 pt-6" data-testid="pemantauan-saved">
        <div className="bg-white rounded-3xl border border-emerald-200 p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-lg font-extrabold text-slate-900">Pemantauan hari ini sudah tersimpan ❤️</h1>
        </div>
        {done.length > 0 && (
          <div className="bg-red-50 rounded-3xl border border-red-200 p-5" data-testid="pemantauan-warning">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <b className="text-sm text-red-700">Perlu perhatian</b>
            </div>
            <p className="text-sm text-red-700 leading-relaxed">
              Keluhan Ibu ({done.join(", ")}) memerlukan perhatian. Segera periksa ke fasilitas pelayanan kesehatan.
            </p>
          </div>
        )}
        <button onClick={() => setDone(null)} data-testid="pemantauan-edit" className="w-full py-3.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600">
          Ubah jawaban
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="pemantauan-page">
      <h1 className="text-xl font-extrabold text-slate-900 mb-1">Bagaimana kondisi Ibu hari ini?</h1>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
        <div className="text-sm font-semibold text-slate-800 mb-2.5">Kondisi umum</div>
        <div className="flex gap-2">
          {["Baik", "Kurang baik", "Tidak baik"].map((v) => (
            <button key={v} type="button" data-testid={`kondisi-${v}`} onClick={() => set("kondisi")(v)}
              className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${f.kondisi === v ? "bg-[#FDF2F5] text-[#C02650] border-[#C02650]/40" : "bg-white text-slate-500 border-slate-200"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <RadioYN label="Apakah Ibu mengalami demam?" value={f.demam} onChange={set("demam")} testid="p-demam" />
      {f.demam === "Ya" && (
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.1" data-testid="p-suhu" placeholder="Suhu tubuh (°C)" value={f.suhu} onChange={set("suhu")} className="px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white" />
          <input type="number" data-testid="p-demam-hari" placeholder="Sudah berapa hari?" value={f.demam_hari} onChange={set("demam_hari")} className="px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white" />
        </div>
      )}
      <RadioYN label="Sakit kepala atau pusing berat?" value={f.sakit_kepala} onChange={set("sakit_kepala")} testid="p-sakit-kepala" />
      <RadioYN label="Nyeri perut hebat?" value={f.nyeri_perut} onChange={set("nyeri_perut")} testid="p-nyeri-perut" />
      <RadioYN label="Perdarahan dari jalan lahir?" value={f.perdarahan} onChange={set("perdarahan")} testid="p-perdarahan" />
      <RadioYN label="Cairan keluar dari jalan lahir?" value={f.cairan} onChange={set("cairan")} testid="p-cairan" />
      {f.cairan === "Ya" && <RadioYN label="Cairan sangat banyak atau berbau?" value={f.cairan_banyak} onChange={set("cairan_banyak")} testid="p-cairan-banyak" />}
      <RadioYN label="Sakit saat buang air kecil?" value={f.sakit_bak} onChange={set("sakit_bak")} testid="p-sakit-bak" />
      <RadioYN label="Keputihan atau gatal di daerah kemaluan?" value={f.keputihan} onChange={set("keputihan")} testid="p-keputihan" />
      <RadioYN label="Mual atau muntah?" value={f.mual} onChange={set("mual")} testid="p-mual" />
      {f.mual === "Ya" && (
        <div className="flex gap-2">
          {["Ringan", "Sedang", "Berat"].map((v) => (
            <button key={v} type="button" data-testid={`p-mual-${v.toLowerCase()}`} onClick={() => set("mual_tingkat")(v)}
              className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${f.mual_tingkat === v ? "bg-[#FDF2F5] text-[#C02650] border-[#C02650]/40" : "bg-white text-slate-500 border-slate-200"}`}>
              {v}
            </button>
          ))}
        </div>
      )}
      <RadioYN label="Diare berulang?" value={f.diare} onChange={set("diare")} testid="p-diare" />
      <RadioYN label="Sesak napas atau jantung berdebar?" value={f.sesak} onChange={set("sesak")} testid="p-sesak" />

      <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
        <div className="text-sm font-semibold text-slate-800 mb-2.5">Kondisi emosional Ibu hari ini?</div>
        <div className="flex flex-wrap gap-2">
          {["Sangat baik", "Baik", "Biasa saja", "Sedih/cemas", "Sangat sedih/cemas"].map((v) => (
            <button key={v} type="button" data-testid={`p-emosi-${v}`} onClick={() => set("emosional")(v)}
              className={`px-3.5 py-2.5 rounded-full text-xs font-bold border transition-colors ${f.emosional === v ? "bg-[#FDF2F5] text-[#C02650] border-[#C02650]/40" : "bg-white text-slate-500 border-slate-200"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <RadioYN label="Sulit tidur?" value={f.sulit_tidur} onChange={set("sulit_tidur")} testid="p-sulit-tidur" />

      <textarea data-testid="p-keluhan-lain" rows={2} placeholder="Keluhan lain? (opsional)" value={f.keluhan_lain} onChange={set("keluhan_lain")}
        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C02650]/30" />

      <button type="submit" data-testid="pemantauan-submit" disabled={saving}
        className="w-full py-4 rounded-2xl text-base font-bold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60">
        {saving ? "Menyimpan..." : "SIMPAN PEMANTAUAN"}
      </button>
    </form>
  );
}
