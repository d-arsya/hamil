import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import Modal from "./Modal";

const empty = {
  nama: "",
  no_wa: "",
  alamat: "",
  tanggal_lahir: "",
  hpht: "",
  gravida: 1,
  para: 0,
  abortus: 0,
  penyakit_penyerta: "",
  keluhan_utama: "",
  riwayat_kehamilan: [],
  catatan: "",
};

const HASIL_OPTIONS = ["Lahir hidup", "Abortus", "Lahir mati"];
const PENYULIT_OPTIONS = ["Tidak ada", "Preeklamsia", "Eklampsia", "Vasa previa", "Gangguan plasenta", "Perdarahan akhir kehamilan", "Persalinan prematur", "Lainnya"];

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
  const [penyulitCustoms, setPenyulitCustoms] = useState([]);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...empty, ...initial } : empty);
      api.get("/options/penyulit").then((r) => setPenyulitCustoms(r.data.custom || [])).catch(() => {});
    }
  }, [open, initial]);

  const penyulitOptions = [...PENYULIT_OPTIONS.filter((o) => o !== "Lainnya"), ...penyulitCustoms, "Lainnya"];

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const addRiwayat = () =>
    setForm((f) => ({
      ...f,
      riwayat_kehamilan: [...(f.riwayat_kehamilan || []), { tahun: "", tempat: "", penolong: "", hasil: "Lahir hidup", cara_lahir: "", penyulit: "Tidak ada" }],
    }));
  const setRiwayat = (i, k) => (e) =>
    setForm((f) => {
      const r = [...(f.riwayat_kehamilan || [])];
      r[i] = { ...r[i], [k]: e.target.value };
      return { ...f, riwayat_kehamilan: r };
    });
  const delRiwayat = (i) =>
    setForm((f) => ({ ...f, riwayat_kehamilan: (f.riwayat_kehamilan || []).filter((_, idx) => idx !== i) }));

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
        tanggal_lahir: form.tanggal_lahir || null,
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal Lahir" hint="Usia dihitung otomatis">
            <input data-testid="patient-form-tanggal-lahir" type="date" className={inputCls} value={form.tanggal_lahir || ""} onChange={set("tanggal_lahir")} />
          </Field>
          <Field label="Penyakit Penyerta" hint="cth: diabetes, hipertensi, asma">
            <input data-testid="patient-form-penyakit-penyerta" className={inputCls} value={form.penyakit_penyerta} onChange={set("penyakit_penyerta")} placeholder="Tidak ada" />
          </Field>
        </div>
        <Field label="Keluhan Utama">
          <input data-testid="patient-form-keluhan-utama" className={inputCls} value={form.keluhan_utama} onChange={set("keluhan_utama")} placeholder="cth: mual berat, pusing, perdarahan" />
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
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-600">Riwayat Kehamilan Sebelumnya</label>
            <button type="button" data-testid="riwayat-add-button" onClick={addRiwayat} className="text-xs font-bold text-[#C02650] hover:underline">
              + Tambah Riwayat
            </button>
          </div>
          {(form.riwayat_kehamilan || []).length === 0 && (
            <p className="text-[11px] text-slate-400">Belum ada riwayat (misal kehamilan pertama). Klik tambah untuk mengisi.</p>
          )}
          <div className="space-y-2">
            {(form.riwayat_kehamilan || []).map((r, i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2" data-testid={`riwayat-row-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">Riwayat #{i + 1}</span>
                  <button type="button" data-testid={`riwayat-delete-${i}`} onClick={() => delRiwayat(i)} className="text-xs font-semibold text-red-600 hover:underline">
                    Hapus
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input data-testid={`riwayat-tahun-${i}`} className={inputCls} value={r.tahun} onChange={setRiwayat(i, "tahun")} placeholder="Tahun lahir (cth: 2022)" />
                  <input data-testid={`riwayat-tempat-${i}`} className={inputCls} value={r.tempat} onChange={setRiwayat(i, "tempat")} placeholder="Tempat (RS/puskesmas/rumah)" />
                  <input data-testid={`riwayat-penolong-${i}`} className={inputCls} value={r.penolong} onChange={setRiwayat(i, "penolong")} placeholder="Ditolong nakes (cth: Bidan Ani)" />
                  <select data-testid={`riwayat-hasil-${i}`} className={inputCls} value={r.hasil} onChange={setRiwayat(i, "hasil")}>
                    {HASIL_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                  <select data-testid={`riwayat-cara-lahir-${i}`} className={inputCls} value={r.cara_lahir || ""} onChange={setRiwayat(i, "cara_lahir")}>
                    <option value="">Cara lahir...</option>
                    <option>Normal - Spontan</option>
                    <option>Normal - Vakum/Forceps</option>
                    <option>Sesar (SC)</option>
                  </select>
                  <select
                    data-testid={`riwayat-penyulit-${i}`}
                    className={inputCls}
                    value={penyulitOptions.includes(r.penyulit) ? r.penyulit : "Lainnya"}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r2 = [...(form.riwayat_kehamilan || [])];
                      r2[i] = { ...r2[i], penyulit: v === "Lainnya" ? "" : v };
                      setForm((f) => ({ ...f, riwayat_kehamilan: r2 }));
                    }}
                  >
                    {penyulitOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                {!penyulitOptions.includes(r.penyulit) && (
                  <input
                    data-testid={`riwayat-penyulit-custom-${i}`}
                    className={inputCls}
                    value={r.penyulit}
                    onChange={setRiwayat(i, "penyulit")}
                    placeholder="Tulis masalah/penyulit lainnya — otomatis jadi pilihan untuk pengisian berikutnya"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
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
