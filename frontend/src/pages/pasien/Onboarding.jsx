import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { toast } from "sonner";
import pasienApi, { pasienError } from "../../lib/pasienApi";
import { fmtDate, usiaLabel } from "../../lib/utils-id";
import { FASE_LABEL } from "../../lib/konten";

const inputCls = "w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] bg-white";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function Onboarding({ pasien, onDone }) {
  const [form, setForm] = useState({ golongan_darah: "", nama_pendamping: "", kontak_darurat: "", faskes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await pasienApi.put("/pasien/profil", form);
      toast.success("Profil tersimpan. Selamat menggunakan BidanKu!");
      onDone();
    } catch (err) {
      toast.error(pasienError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] p-5" data-testid="pasien-onboarding">
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center mb-6 pt-4">
          <div className="w-14 h-14 rounded-3xl bg-[#C02650] flex items-center justify-center mb-3">
            <HeartPulse className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Selamat datang, {pasien.nama}!</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">Lengkapi sedikit data agar kami bisa mendampingi Ibu dengan lebih baik.</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 mb-4">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Data Kehamilan Ibu (dari klinik)</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-[11px] text-slate-400 font-semibold">Usia Kehamilan</div><div className="font-bold">{usiaLabel(pasien)}</div></div>
            <div><div className="text-[11px] text-slate-400 font-semibold">Fase</div><div className="font-bold">{FASE_LABEL[pasien.fase]}</div></div>
            <div><div className="text-[11px] text-slate-400 font-semibold">HPL</div><div className="font-bold">{fmtDate(pasien.hpl)}</div></div>
            <div><div className="text-[11px] text-slate-400 font-semibold">Kehamilan ke-</div><div className="font-bold">{pasien.gravida} (P{pasien.para} A{pasien.abortus})</div></div>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-4">
          <Field label="Golongan Darah (opsional)">
            <select data-testid="onboarding-goldar" className={inputCls} value={form.golongan_darah} onChange={set("golongan_darah")}>
              <option value="">Pilih...</option>
              {["A", "B", "AB", "O", "Belum tahu"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Nama Pendamping / Suami">
            <input data-testid="onboarding-pendamping" className={inputCls} value={form.nama_pendamping} onChange={set("nama_pendamping")} placeholder="cth: Budi Santoso" />
          </Field>
          <Field label="Nomor Kontak Darurat">
            <input data-testid="onboarding-kontak" className={inputCls} value={form.kontak_darurat} onChange={set("kontak_darurat")} placeholder="cth: 0812xxxxxxx" />
          </Field>
          <Field label="Faskes Tempat Pemeriksaan">
            <input data-testid="onboarding-faskes" className={inputCls} value={form.faskes} onChange={set("faskes")} placeholder="cth: Puskesmas Depok" />
          </Field>
          <button type="submit" data-testid="onboarding-submit" disabled={saving} className="w-full px-4 py-4 rounded-2xl text-base font-bold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60">
            {saving ? "Menyimpan..." : "Simpan & Mulai"}
          </button>
        </form>
      </div>
    </div>
  );
}
