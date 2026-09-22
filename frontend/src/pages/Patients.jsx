import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, MessageCircle, Pencil, Trash2, Eye, Gift } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import StatusBadge, { FaseBadge, RiskBadges, riskNameColor } from "../components/StatusBadge";
import PatientForm from "../components/PatientForm";
import WaReminder from "../components/WaReminder";
import { useAuth } from "../context/AuthContext";
import { fmtDate, usiaLabel, sanitizePhone } from "../lib/utils-id";

const FILTERS = [
  ["semua", "Semua"],
  ["hari_ini", "Hari Ini"],
  ["terlambat", "Terlambat"],
  ["mendekati", "Mendekati"],
  ["sudah_kontrol", "Sudah Kontrol"],
  ["trimester_1", "Trimester 1"],
  ["trimester_2", "Trimester 2"],
  ["trimester_3", "Trimester 3"],
  ["nifas", "Nifas"],
];

export default function Patients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState(null);
  const [filter, setFilter] = useState("semua");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [waPatient, setWaPatient] = useState(null);

  const load = () => api.get("/patients").then((r) => setPatients(r.data));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!patients) return [];
    let list = patients;
    if (filter !== "semua") list = list.filter((p) => p.status === filter || p.fase === filter);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      const digits = sanitizePhone(q);
      list = list.filter(
        (p) => p.nama.toLowerCase().includes(s) || (digits && sanitizePhone(p.no_wa).includes(digits))
      );
    }
    return list;
  }, [patients, filter, q]);

  const del = async (p) => {
    if (!window.confirm(`Hapus pasien ${p.nama}? Seluruh riwayat kontrolnya ikut terhapus.`)) return;
    try {
      await api.delete(`/patients/${p.id}`);
      toast.success("Pasien dihapus");
      load();
    } catch {
      toast.error("Gagal menghapus pasien");
    }
  };

  return (
    <div data-testid="patients-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Daftar Pasien</h1>
          <p className="text-sm text-slate-500 mt-1">Monitoring ibu hamil sampai masa nifas.</p>
        </div>
        <button
          data-testid="add-patient-button"
          onClick={() => {
            setEditPatient(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Pasien
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            data-testid="patient-search-input"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
            placeholder="Cari nama atau nomor WA..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            data-testid={`filter-${k}`}
            onClick={() => setFilter(k)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 mb-5 -mt-2" data-testid="filter-legend">
        Keterangan: <b>Mendekati</b> = jadwal kontrol dalam 7 hari ke depan · <b>Terlambat</b> = sudah lewat jadwal (jumlah harinya tampil di kolom jadwal) · <b>Sudah Kontrol</b> = kontrol periode berjalan sudah dilakukan. ANC: Trimester 1 = 2x (K1-K2, mgg 12 &amp; 16), Trimester 2 = 1x (K3, mgg 26), Trimester 3 = 3x (K4-K6, mgg 32/36/39), Nifas = 4x (KF1-KF4, hari ke-2/7/14/42).
      </p>

      {!patients ? (
        <div className="text-sm text-slate-400 animate-pulse" data-testid="patients-loading">Memuat data pasien...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 px-5 py-12 text-center text-sm text-slate-400" data-testid="patients-empty-state">
          Tidak ada pasien pada filter ini.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Pasien</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">No. WA</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Fase / Usia</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Jadwal Berikutnya</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`patient-row-${p.id}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        to={`/pasien/${p.id}`}
                        className={`font-bold hover:underline transition-colors ${riskNameColor(p.penyakit_penyerta) || "text-slate-900 hover:text-[#C02650]"}`}
                      >
                        {p.nama}
                      </Link>
                      {p.kupon_eligible && !p.kupon_diklaim && (
                        <span data-testid={`kupon-badge-${p.id}`} title="Berhak kupon pijat bayi gratis" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <Gift className="w-3 h-3" /> Kupon
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <RiskBadges penyakit={p.penyakit_penyerta} testidPrefix={`risk-${p.id}`} />
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {p.usia_tahun != null ? `${p.usia_tahun} th · ` : ""}G{p.gravida} P{p.para} A{p.abortus}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{p.no_wa}</td>
                  <td className="px-5 py-3.5">
                    <FaseBadge fase={p.fase} />
                    <div className="text-xs text-slate-500 mt-1">{usiaLabel(p)}</div>
                    <div className="text-xs mt-1 flex items-center gap-1.5" data-testid={`kontrol-progress-${p.id}`}>
                      <span className="text-slate-500">Kontrol {p.fase === "nifas" ? "KF" : p.fase.replace("trimester_", "T")}: {p.kontrol_fase_ke}/{p.kontrol_fase_total}</span>
                      {p.kontrol_fase_ke >= p.kontrol_fase_total ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">Lengkap</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">Belum lengkap</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-800">{fmtDate(p.jadwal_berikutnya)}</div>
                    <div className="text-xs text-slate-400">{p.kunjungan_berikutnya ? `Kunjungan ${p.kunjungan_berikutnya}` : "-"}</div>
                    {p.selisih_hari != null && (
                      <div
                        data-testid={`selisih-hari-${p.id}`}
                        className={`text-[11px] font-semibold mt-0.5 ${
                          p.selisih_hari < 0 ? "text-red-600" : p.selisih_hari <= 7 ? "text-amber-600" : "text-slate-400"
                        }`}
                      >
                        {p.selisih_hari < 0 ? `Terlambat ${-p.selisih_hari} hari` : p.selisih_hari === 0 ? "Jatuh tempo hari ini" : `${p.selisih_hari} hari lagi`}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        data-testid={`patient-wa-button-${p.id}`}
                        title="Kirim pengingat WA"
                        onClick={() => setWaPatient(p)}
                        className="p-2 rounded-lg text-[#128C4A] hover:bg-[#25D366]/10 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <Link
                        data-testid={`patient-detail-button-${p.id}`}
                        title="Detail pasien"
                        to={`/pasien/${p.id}`}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        data-testid={`patient-edit-button-${p.id}`}
                        title="Edit pasien"
                        onClick={() => {
                          setEditPatient(p);
                          setFormOpen(true);
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        data-testid={`patient-delete-button-${p.id}`}
                        title="Hapus pasien"
                        onClick={() => del(p)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PatientForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} initial={editPatient} />
      <WaReminder open={Boolean(waPatient)} onClose={() => setWaPatient(null)} patient={waPatient} bidanNama={user?.nama} />
    </div>
  );
}
