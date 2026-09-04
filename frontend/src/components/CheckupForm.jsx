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
  const empty = { tanggal: today, sistolik: "", diastolik: "", berat_badan: "", tinggi_fundus: "", djj: "", keluhan: "", catatan: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...empty, tanggal: today });
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

  const jenisLabel = patient?.fase === "nifas" ? `Kunjungan Nifas (${patient.kunjungan_berikutnya || "KF"})` : `Pemeriksaan ANC (${patient?.kunjungan_berikutnya || "K"})`;

  return (
    <Modal open={open} onClose={onClose} title={`Catat Kontrol — ${patient?.nama || ""}`} testid="checkup-form-modal">
      <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#FDF2F5] text-[#C02650] text-xs font-semibold" data-testid="checkup-jenis-label">
        {jenisLabel}
      </div>
      <form onSubmit={submit} className="space-y-4">
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
        <Field label="Keluhan">
          <textarea data-testid="checkup-form-keluhan" className={inputCls} rows={2} value={form.keluhan} onChange={set("keluhan")} placeholder="Keluhan ibu saat kontrol" />
        </Field>
        <Field label="Catatan Bidan">
          <textarea data-testid="checkup-form-catatan" className={inputCls} rows={2} value={form.catatan} onChange={set("catatan")} placeholder="Hasil pemeriksaan, anjuran, terapi" />
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
