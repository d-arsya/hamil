import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import Modal from "./Modal";

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors bg-white";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function CheckupForm({ open, onClose, onSaved, patient }) {
  const today = new Date().toISOString().slice(0, 10);
  const empty = { tanggal: today, jenis: "anc", sistolik: "", diastolik: "", spo2: "", suhu: "", nadi: "", rr: "", lila: "", tinggi_badan: "", berat_badan: "", tinggi_fundus: "", djj: "", keluhan: "", catatan: "", rencana_tindak_lanjut: "", jenis_kb: "", kontrol_kb: false, imunisasi_diberikan: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const m = /(\d+)/.exec(patient?.kunjungan_berikutnya || "");
      setForm({ ...empty, tanggal: today, jenis: patient?.fase === "nifas" ? "kf" : "anc", ke: m ? String(Number(m[1])) : "1" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (v) => (v === "" || v == null ? null : Number(v));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/patients/${patient.id}/checkups`, {
        tanggal: form.tanggal,
        sistolik: num(form.sistolik),
        diastolik: num(form.diastolik),
        berat_badan: num(form.berat_badan),
        tinggi_fundus: num(form.tinggi_fundus),
        djj: num(form.djj),
        keluhan: form.keluhan,
        catatan: form.catatan,
        rencana_tindak_lanjut: form.rencana_tindak_lanjut,
        jenis: form.jenis,
        ke: parseInt(form.ke) || null,
        spo2: num(form.spo2),
        suhu: num(form.suhu),
        nadi: num(form.nadi),
        rr: num(form.rr),
        lila: num(form.lila),
        tinggi_badan: num(form.tinggi_badan),
        jenis_kb: form.jenis === "kf" ? form.jenis_kb : "",
        kontrol_kb: form.jenis === "kf" ? form.kontrol_kb : false,
        imunisasi_diberikan: form.jenis === "kf" ? form.imunisasi_diberikan : "",
      });
      toast.success("Kontrol berhasil dicatat — status pasien diperbarui");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan data kontrol"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Catat Kontrol — ${patient?.nama || ""}`} testid="checkup-form-modal">
      <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#FDF2F5]" data-testid="checkup-jenis-label">
        <label className="block text-[11px] font-bold text-[#C02650] mb-1">Jenis Kunjungan</label>
        <select data-testid="checkup-form-jenis" className={inputCls} value={form.jenis} onChange={set("jenis")}>
          <option value="anc">ANC — Antenatal (kontrol kehamilan)</option>
          <option value="kf">PNC — Postnatal (kontrol nifas)</option>
        </select>
        <p className="text-[11px] text-slate-400 mt-1">Pilih PNC jika kunjungan ini untuk nifas meskipun pasien belum ditandai persalinan, atau sebaliknya.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label={`Kunjungan ${form.jenis === "kf" ? "PNC" : "ANC"} ke-`}>
          <select data-testid="checkup-form-ke" className={inputCls} value={form.ke} onChange={set("ke")}>
            {(form.jenis === "kf" ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6]).map((n) => (
              <option key={n} value={n}>{form.jenis === "kf" ? `KF${n} (hari ke-${[2, 7, 14, 42][n - 1]})` : `K${n} (mgg ke-${[12, 16, 26, 32, 36, 39][n - 1]})`}</option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal Kontrol">
          <input data-testid="checkup-form-tanggal" type="date" className={inputCls} value={form.tanggal} onChange={set("tanggal")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="TD Sistolik (mmHg)">
            <input data-testid="checkup-form-sistolik" type="number" className={inputCls} value={form.sistolik} onChange={set("sistolik")} placeholder="cth: 110" />
          </Field>
          <Field label="TD Diastolik (mmHg)">
            <input data-testid="checkup-form-diastolik" type="number" className={inputCls} value={form.diastolik} onChange={set("diastolik")} placeholder="cth: 70" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="SpO2 (%)">
            <input data-testid="checkup-form-spo2" type="number" className={inputCls} value={form.spo2} onChange={set("spo2")} placeholder="cth: 98" />
          </Field>
          <Field label="Suhu (°C)">
            <input data-testid="checkup-form-suhu" type="number" step="0.1" className={inputCls} value={form.suhu} onChange={set("suhu")} placeholder="cth: 36.5" />
          </Field>
          <Field label="Nadi (x/mnt)">
            <input data-testid="checkup-form-nadi" type="number" className={inputCls} value={form.nadi} onChange={set("nadi")} placeholder="cth: 80" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="RR (x/mnt)">
            <input data-testid="checkup-form-rr" type="number" className={inputCls} value={form.rr} onChange={set("rr")} placeholder="cth: 20" />
          </Field>
          <Field label="LiLa (cm)">
            <input data-testid="checkup-form-lila" type="number" step="0.1" className={inputCls} value={form.lila} onChange={set("lila")} placeholder="cth: 25.5" />
          </Field>
          <Field label="Tinggi Badan (cm)">
            <input data-testid="checkup-form-tb" type="number" step="0.1" className={inputCls} value={form.tinggi_badan} onChange={set("tinggi_badan")} placeholder="cth: 155" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Berat Badan (kg)">
            <input data-testid="checkup-form-bb" type="number" step="0.1" className={inputCls} value={form.berat_badan} onChange={set("berat_badan")} placeholder="cth: 58.5" />
          </Field>
          <Field label="Tinggi Fundus (cm)">
            <input data-testid="checkup-form-tfu" type="number" step="0.5" className={inputCls} value={form.tinggi_fundus} onChange={set("tinggi_fundus")} />
          </Field>
          <Field label="DJJ (x/mnt)">
            <input data-testid="checkup-form-djj" type="number" className={inputCls} value={form.djj} onChange={set("djj")} />
          </Field>
        </div>
        {form.jenis === "kf" && (
          <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-100 space-y-3" data-testid="checkup-nifas-section">
            <div className="text-xs font-bold text-purple-700">
              Khusus Kunjungan Nifas (PNC){patient.tanggal_persalinan ? ` — bayi berusia ${patient.hari_nifas ?? 0} hari` : ""}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pemasangan / Jenis KB">
                <select data-testid="checkup-form-kb" className={inputCls} value={form.jenis_kb} onChange={set("jenis_kb")}>
                  <option value="">Belum / tidak pasang</option>
                  <option>Suntik 1 bulan</option>
                  <option>Suntik 3 bulan</option>
                  <option>Pil KB</option>
                  <option>Implan (Susuk)</option>
                  <option>IUD (Spiral)</option>
                  <option>Kondom</option>
                  <option>MOW / MOP</option>
                </select>
              </Field>
              <Field label="Imunisasi Bayi yang Diberikan">
                <input data-testid="checkup-form-imunisasi" className={inputCls} value={form.imunisasi_diberikan} onChange={set("imunisasi_diberikan")} placeholder="cth: HB-0, BCG + Polio 0" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                data-testid="checkup-form-kontrol-kb"
                checked={form.kontrol_kb}
                onChange={(e) => setForm((f) => ({ ...f, kontrol_kb: e.target.checked }))}
                className="accent-[#C02650]"
              />
              Perlu kontrol rutin untuk KB
            </label>
          </div>
        )}
        <Field label="Keluhan">
          <textarea data-testid="checkup-form-keluhan" className={inputCls} rows={2} value={form.keluhan} onChange={set("keluhan")} placeholder="Keluhan ibu saat kontrol" />
        </Field>
        <Field label="Catatan Bidan">
          <textarea data-testid="checkup-form-catatan" className={inputCls} rows={2} value={form.catatan} onChange={set("catatan")} placeholder="Hasil pemeriksaan, anjuran, terapi" />
        </Field>
        <Field label="Rencana Tindak Lanjut (kontrol berikutnya)" hint="cth: cek lab, pantau tekanan darah, USG — akan tampil di kartu jadwal pasien">
          <textarea data-testid="checkup-form-rtl" className={inputCls} rows={2} value={form.rencana_tindak_lanjut} onChange={set("rencana_tindak_lanjut")} placeholder="Rencana untuk kunjungan berikutnya" />
        </Field>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            data-testid="checkup-form-cancel"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            data-testid="checkup-form-submit"
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan Kontrol"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
