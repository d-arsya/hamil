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

export default function CheckupForm({ open, onClose, onSaved, patient, initial, checkups = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = Boolean(initial);
  const empty = {
    tanggal: today, jenis: "anc", ke: "1",
    sistolik: "", diastolik: "", spo2: "", suhu: "", nadi: "", rr: "", tinggi_badan: "", berat_badan: "", tinggi_fundus: "",
    djj: "", letak_plasenta: "", ketuban: "", tbj: "", jumlah_janin: "", keadaan_janin: "", lokasi_kehamilan: "", presentasi: "", jk_janin: "",
    bayi_bb: "", bayi_pb: "", bayi_lk: "", bayi_suhu: "", bayi_tali_pusat: "", bayi_ikterus: "",
    keluhan: "", catatan: "", rencana_tindak_lanjut: "", jenis_kb: "", kontrol_kb: false, imunisasi_diberikan: "",
  };
  const [form, setForm] = useState(empty);
  const [tandai, setTandai] = useState([]);
  const [saving, setSaving] = useState(false);

  const s = (v) => (v === "" || v == null ? "" : String(v));

  useEffect(() => {
    if (open) {
      setTandai([]);
      if (initial) {
        setForm({
          ...empty,
          tanggal: initial.tanggal || today,
          jenis: initial.jenis || "anc",
          ke: s(initial.ke) || "1",
          sistolik: s(initial.sistolik), diastolik: s(initial.diastolik), spo2: s(initial.spo2), suhu: s(initial.suhu),
          nadi: s(initial.nadi), rr: s(initial.rr), tinggi_badan: s(initial.tinggi_badan), berat_badan: s(initial.berat_badan),
          tinggi_fundus: s(initial.tinggi_fundus), djj: s(initial.djj),
          letak_plasenta: initial.letak_plasenta || "", ketuban: initial.ketuban || "", tbj: s(initial.tbj),
          jumlah_janin: initial.jumlah_janin || "", keadaan_janin: initial.keadaan_janin || "",
          lokasi_kehamilan: initial.lokasi_kehamilan || "", presentasi: initial.presentasi || "", jk_janin: initial.jk_janin || "",
          bayi_bb: s(initial.bayi_bb), bayi_pb: s(initial.bayi_pb), bayi_lk: s(initial.bayi_lk), bayi_suhu: s(initial.bayi_suhu),
          bayi_tali_pusat: initial.bayi_tali_pusat || "", bayi_ikterus: initial.bayi_ikterus || "",
          keluhan: initial.keluhan || "", catatan: initial.catatan || "",
          rencana_tindak_lanjut: initial.rencana_tindak_lanjut || "",
          jenis_kb: initial.jenis_kb || "", kontrol_kb: Boolean(initial.kontrol_kb),
          imunisasi_diberikan: initial.imunisasi_diberikan || "",
        });
      } else {
        const m = /(\d+)/.exec(patient?.kunjungan_berikutnya || "");
        setForm({ ...empty, tanggal: today, jenis: patient?.fase === "nifas" ? "kf" : "anc", ke: m ? String(Number(m[1])) : "1" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (v) => (v === "" || v == null ? null : Number(v));

  const daftarKunjungan = form.jenis === "kf" ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6];
  const prefix = form.jenis === "kf" ? "KF" : "K";
  const labelKunjungan = (n) => (form.jenis === "kf" ? `KF${n} (hari ke-${[2, 7, 14, 42][n - 1]})` : `K${n} (mgg ke-${[12, 16, 26, 32, 36, 39][n - 1]})`);
  const sudahTercatat = new Set(checkups.filter((c) => c.jenis === form.jenis).map((c) => c.ke));
  const bisaDitandai = daftarKunjungan.filter((n) => n !== Number(form.ke) && !sudahTercatat.has(n));
  const toggleTandai = (n) => setTandai((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t, n].sort((a, b) => a - b)));

  const buildPayload = () => ({
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
    tinggi_badan: num(form.tinggi_badan),
    letak_plasenta: form.jenis === "anc" ? form.letak_plasenta : "",
    ketuban: form.jenis === "anc" ? form.ketuban : "",
    tbj: form.jenis === "anc" ? num(form.tbj) : null,
    jumlah_janin: form.jenis === "anc" ? form.jumlah_janin : "",
    keadaan_janin: form.jenis === "anc" ? form.keadaan_janin : "",
    lokasi_kehamilan: form.jenis === "anc" ? form.lokasi_kehamilan : "",
    presentasi: form.jenis === "anc" ? form.presentasi : "",
    jk_janin: form.jenis === "anc" ? form.jk_janin : "",
    bayi_bb: form.jenis === "kf" ? num(form.bayi_bb) : null,
    bayi_pb: form.jenis === "kf" ? num(form.bayi_pb) : null,
    bayi_lk: form.jenis === "kf" ? num(form.bayi_lk) : null,
    bayi_suhu: form.jenis === "kf" ? num(form.bayi_suhu) : null,
    bayi_tali_pusat: form.jenis === "kf" ? form.bayi_tali_pusat : "",
    bayi_ikterus: form.jenis === "kf" ? form.bayi_ikterus : "",
    jenis_kb: form.jenis === "kf" ? form.jenis_kb : "",
    kontrol_kb: form.jenis === "kf" ? form.kontrol_kb : false,
    imunisasi_diberikan: form.jenis === "kf" ? form.imunisasi_diberikan : "",
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/checkups/${initial.id}`, buildPayload());
        toast.success("Perubahan data kontrol tersimpan");
      } else {
        await api.post(`/patients/${patient.id}/checkups`, buildPayload());
        const gagal = [];
        for (const n of tandai) {
          try {
            await api.post(`/patients/${patient.id}/checkups`, {
              tanggal: form.tanggal,
              jenis: form.jenis,
              ke: n,
              catatan: "Ditandai manual — tanpa data pemeriksaan",
            });
          } catch {
            gagal.push(`${prefix}${n}`);
          }
        }
        toast.success(gagal.length ? `Kontrol tersimpan, namun ${gagal.join(", ")} gagal ditandai` : "Kontrol berhasil dicatat — status pasien diperbarui");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan data kontrol"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${isEdit ? "Edit Kontrol" : "Catat Kontrol"} — ${patient?.nama || ""}`} testid="checkup-form-modal">
      <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#FDF2F5]" data-testid="checkup-jenis-label">
        <label className="block text-[11px] font-bold text-[#C02650] mb-1">Jenis Kunjungan</label>
        <select data-testid="checkup-form-jenis" className={inputCls} value={form.jenis} onChange={set("jenis")} disabled={isEdit}>
          <option value="anc">ANC — Antenatal (kontrol kehamilan)</option>
          <option value="kf">PNC — Postnatal (kontrol nifas)</option>
        </select>
        {!isEdit && <p className="text-[11px] text-slate-400 mt-1">Pilih PNC jika kunjungan ini untuk nifas meskipun pasien belum ditandai persalinan, atau sebaliknya.</p>}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label={`Kunjungan ${form.jenis === "kf" ? "PNC" : "ANC"} ke-`}>
          <select data-testid="checkup-form-ke" className={inputCls} value={form.ke} onChange={set("ke")} disabled={isEdit}>
            {daftarKunjungan.map((n) => (
              <option key={n} value={n}>{labelKunjungan(n)}</option>
            ))}
          </select>
        </Field>

        {!isEdit && bisaDitandai.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200" data-testid="checkup-tandai-sebelumnya">
            <div className="text-xs font-bold text-slate-600 mb-2">Tandai kunjungan lain yang sudah dilakukan (tanpa data pemeriksaan)</div>
            <div className="flex flex-wrap gap-2">
              {bisaDitandai.map((n) => (
                <label key={n} data-testid={`checkup-tandai-${prefix}${n}`} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer transition-colors ${tandai.includes(n) ? "bg-[#FDF2F5] text-[#C02650] border-[#C02650]/40" : "bg-white text-slate-500 border-slate-200"}`}>
                  <input type="checkbox" className="hidden" checked={tandai.includes(n)} onChange={() => toggleTandai(n)} />
                  {tandai.includes(n) ? "✓ " : ""}{prefix}{n}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Untuk kunjungan yang dilakukan di tempat lain / sebelum pasien terdaftar — tercatat tanpa data pemeriksaan.</p>
          </div>
        )}

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
          <Field label="Tinggi Badan (cm)">
            <input data-testid="checkup-form-tb" type="number" step="0.1" className={inputCls} value={form.tinggi_badan} onChange={set("tinggi_badan")} placeholder="cth: 155" />
          </Field>
          <Field label="Berat Badan (kg)">
            <input data-testid="checkup-form-bb" type="number" step="0.1" className={inputCls} value={form.berat_badan} onChange={set("berat_badan")} placeholder="cth: 58.5" />
          </Field>
        </div>

        {form.jenis === "anc" && (
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100 space-y-3" data-testid="checkup-bayi-anc-section">
            <div className="text-xs font-bold text-sky-700">Detail Bayi (hasil pemeriksaan / USG)</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tinggi Fundus (cm)">
                <input data-testid="checkup-form-tfu" type="number" step="0.5" className={inputCls} value={form.tinggi_fundus} onChange={set("tinggi_fundus")} />
              </Field>
              <Field label="DJJ (x/mnt)">
                <input data-testid="checkup-form-djj" type="number" className={inputCls} value={form.djj} onChange={set("djj")} placeholder="cth: 140" />
              </Field>
              <Field label="TBJ (gram)">
                <input data-testid="checkup-form-tbj" type="number" className={inputCls} value={form.tbj} onChange={set("tbj")} placeholder="cth: 1500" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Letak Plasenta">
                <select data-testid="checkup-form-plasenta" className={inputCls} value={form.letak_plasenta} onChange={set("letak_plasenta")}>
                  <option value="">—</option>
                  <option>Fundus</option>
                  <option>Anterior</option>
                  <option>Posterior</option>
                  <option>Lateral</option>
                  <option>Korpus</option>
                  <option>Letak rendah</option>
                </select>
              </Field>
              <Field label="Air Ketuban">
                <select data-testid="checkup-form-ketuban" className={inputCls} value={form.ketuban} onChange={set("ketuban")}>
                  <option value="">—</option>
                  <option>Cukup</option>
                  <option>Kurang</option>
                  <option>Lebih</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jumlah Janin">
                <select data-testid="checkup-form-jumlah-janin" className={inputCls} value={form.jumlah_janin} onChange={set("jumlah_janin")}>
                  <option value="">—</option>
                  <option>Tunggal</option>
                  <option>Lebih dari satu</option>
                </select>
              </Field>
              <Field label="Keadaan Janin">
                <select data-testid="checkup-form-keadaan-janin" className={inputCls} value={form.keadaan_janin} onChange={set("keadaan_janin")}>
                  <option value="">—</option>
                  <option>Hidup</option>
                  <option>Mati</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Lokasi">
                <select data-testid="checkup-form-lokasi" className={inputCls} value={form.lokasi_kehamilan} onChange={set("lokasi_kehamilan")}>
                  <option value="">—</option>
                  <option>Intrauterine</option>
                  <option>Ekstrauterine</option>
                </select>
              </Field>
              <Field label="Presentasi">
                <select data-testid="checkup-form-presentasi" className={inputCls} value={form.presentasi} onChange={set("presentasi")}>
                  <option value="">—</option>
                  <option>Kepala</option>
                  <option>Bokong</option>
                  <option>Lintang</option>
                  <option>Oblique</option>
                </select>
              </Field>
              <Field label="Jenis Kelamin">
                <select data-testid="checkup-form-jk-janin" className={inputCls} value={form.jk_janin} onChange={set("jk_janin")}>
                  <option value="">—</option>
                  <option>Laki-laki</option>
                  <option>Perempuan</option>
                  <option>Belum diketahui</option>
                </select>
              </Field>
            </div>
          </div>
        )}

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

            <div className="pt-2 border-t border-purple-100">
              <div className="text-xs font-bold text-purple-700 mb-2">Pemeriksaan Fisik Bayi</div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Berat Badan (gr)">
                  <input data-testid="checkup-form-bayi-bb" type="number" className={inputCls} value={form.bayi_bb} onChange={set("bayi_bb")} placeholder="cth: 3100" />
                </Field>
                <Field label="Panjang Badan (cm)">
                  <input data-testid="checkup-form-bayi-pb" type="number" step="0.1" className={inputCls} value={form.bayi_pb} onChange={set("bayi_pb")} placeholder="cth: 49" />
                </Field>
                <Field label="Lingkar Kepala (cm)">
                  <input data-testid="checkup-form-bayi-lk" type="number" step="0.1" className={inputCls} value={form.bayi_lk} onChange={set("bayi_lk")} placeholder="cth: 34" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Suhu Bayi (°C)">
                  <input data-testid="checkup-form-bayi-suhu" type="number" step="0.1" className={inputCls} value={form.bayi_suhu} onChange={set("bayi_suhu")} placeholder="cth: 36.8" />
                </Field>
                <Field label="Tali Pusat">
                  <select data-testid="checkup-form-bayi-tali-pusat" className={inputCls} value={form.bayi_tali_pusat} onChange={set("bayi_tali_pusat")}>
                    <option value="">—</option>
                    <option>Bersih & kering</option>
                    <option>Lembab</option>
                    <option>Terlepas</option>
                    <option>Tanda infeksi</option>
                  </select>
                </Field>
                <Field label="Ikterus (kuning)">
                  <select data-testid="checkup-form-bayi-ikterus" className={inputCls} value={form.bayi_ikterus} onChange={set("bayi_ikterus")}>
                    <option value="">—</option>
                    <option>Tidak</option>
                    <option>Ya</option>
                  </select>
                </Field>
              </div>
            </div>
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
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Kontrol"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
