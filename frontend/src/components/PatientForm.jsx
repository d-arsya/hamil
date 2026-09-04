import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import Modal from "./Modal";

const empty = {
  nama: "",
  no_wa: "",
  alamat: "",
  hpht: "",
  gravida: 1,
  para: 0,
  abortus: 0,
  riwayat: "",
  catatan: "",
};

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

export default function PatientForm({ open, onClose, onSaved, initial }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) setForm(initial ? { ...empty, ...initial } : empty);
  }, [open, initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nama.trim() || !form.no_wa.trim() || !form.hpht) {
      toast.error("Nama, No. WhatsApp, dan HPHT wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        gravida: parseInt(form.gravida) || 1,
        para: parseInt(form.para) || 0,
        abortus: parseInt(form.abortus) || 0,
      };
      if (isEdit) await api.put(`/patients/${initial.id}`, payload);
      else await api.post("/patients", payload);
      toast.success(isEdit ? "Data pasien diperbarui" : "Pasien baru ditambahkan");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan data pasien"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Data Pasien" : "Tambah Pasien Baru"} testid="patient-form-modal">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama Lengkap *">
          <input data-testid="patient-form-nama" className={inputCls} value={form.nama} onChange={set("nama")} placeholder="cth: Siti Rahmawati" />
        </Field>
        <Field label="No. WhatsApp *" hint="Format 08xx atau 628xx">
          <input data-testid="patient-form-wa" className={inputCls} value={form.no_wa} onChange={set("no_wa")} placeholder="cth: 081234567890" />
        </Field>
        <Field label="Alamat">
          <textarea data-testid="patient-form-alamat" className={inputCls} rows={2} value={form.alamat} onChange={set("alamat")} placeholder="Alamat tempat tinggal" />
        </Field>
        <Field label="HPHT (Hari Pertama Haid Terakhir) *" hint="HPL & jadwal kontrol dihitung otomatis dari tanggal ini">
          <input data-testid="patient-form-hpht" type="date" className={inputCls} value={form.hpht} onChange={set("hpht")} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Gravida (G)">
            <input data-testid="patient-form-gravida" type="number" min="1" className={inputCls} value={form.gravida} onChange={set("gravida")} />
          </Field>
          <Field label="Para (P)">
            <input data-testid="patient-form-para" type="number" min="0" className={inputCls} value={form.para} onChange={set("para")} />
          </Field>
          <Field label="Abortus (A)">
            <input data-testid="patient-form-abortus" type="number" min="0" className={inputCls} value={form.abortus} onChange={set("abortus")} />
          </Field>
        </div>
        <Field label="Riwayat Kehamilan / Penyakit" hint="cth: riwayat SC, hipertensi, diabetes">
          <textarea data-testid="patient-form-riwayat" className={inputCls} rows={2} value={form.riwayat} onChange={set("riwayat")} />
        </Field>
        <Field label="Catatan Tambahan">
          <textarea data-testid="patient-form-catatan" className={inputCls} rows={2} value={form.catatan} onChange={set("catatan")} />
        </Field>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            data-testid="patient-form-cancel"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            data-testid="patient-form-submit"
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Pasien"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
