import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Baby, ClipboardPlus, MessageCircle, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import api from "../lib/api";
import StatusBadge, { FaseBadge } from "../components/StatusBadge";
import PatientForm from "../components/PatientForm";
import CheckupForm from "../components/CheckupForm";
import WaReminder from "../components/WaReminder";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { fmtDate, usiaLabel } from "../lib/utils-id";

const cardCls = "bg-white rounded-xl border border-slate-200/80 p-5";

function InfoItem({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800 mt-0.5">{value || "-"}</div>
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [checkupOpen, setCheckupOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");

  const load = () => api.get(`/patients/${id}`).then((r) => setData(r.data)).catch(() => navigate("/pasien"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <div className="text-sm text-slate-400 animate-pulse" data-testid="patient-detail-loading">Memuat data pasien...</div>;

  const { pasien: p, checkups } = data;

  const saveDelivery = async () => {
    if (!deliveryDate) {
      toast.error("Pilih tanggal persalinan");
      return;
    }
    try {
      await api.put(`/patients/${p.id}/persalinan`, { tanggal_persalinan: deliveryDate });
      toast.success("Persalinan dicatat — pasien masuk fase nifas");
      setDeliveryOpen(false);
      load();
    } catch {
      toast.error("Gagal menyimpan tanggal persalinan");
    }
  };

  const deleteCheckup = async (cid) => {
    if (!window.confirm("Hapus catatan kontrol ini?")) return;
    await api.delete(`/checkups/${cid}`);
    toast.success("Catatan kontrol dihapus");
    load();
  };

  const deletePatient = async () => {
    if (!window.confirm(`Hapus pasien ${p.nama}? Seluruh riwayat kontrolnya ikut terhapus.`)) return;
    await api.delete(`/patients/${p.id}`);
    toast.success("Pasien dihapus");
    navigate("/pasien");
  };

  const chartData = checkups.map((c) => ({
    ...c,
    label: fmtDate(c.tanggal),
  }));

  return (
    <div data-testid="patient-detail-page">
      <Link to="/pasien" data-testid="back-to-patients-link" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#C02650] transition-colors mb-5">
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke daftar pasien
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900" data-testid="patient-name">{p.nama}</h1>
            <FaseBadge fase={p.fase} />
            <StatusBadge status={p.status} />
          </div>
          <p className="text-sm text-slate-500">{usiaLabel(p)} · G{p.gravida} P{p.para} A{p.abortus}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="record-checkup-button"
            onClick={() => setCheckupOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors"
          >
            <ClipboardPlus className="w-4 h-4" /> Catat Kontrol
          </button>
          <button
            data-testid="wa-reminder-button"
            onClick={() => setWaOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#25D366]/10 text-[#128C4A] border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> Ingatkan WA
          </button>
          {p.fase !== "nifas" && (
            <button
              data-testid="mark-delivery-button"
              onClick={() => setDeliveryOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <Baby className="w-4 h-4" /> Tandai Persalinan
            </button>
          )}
          <button
            data-testid="edit-patient-button"
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button
            data-testid="delete-patient-button"
            onClick={deletePatient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Hapus
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Data Pasien</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="No. WhatsApp" value={p.no_wa} />
            <InfoItem label="Alamat" value={p.alamat} />
            <InfoItem label="Riwayat" value={p.riwayat} />
            <InfoItem label="Catatan" value={p.catatan} />
          </div>
        </div>
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Kehamilan</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="HPHT" value={fmtDate(p.hpht)} />
            <InfoItem label="HPL" value={fmtDate(p.hpl)} />
            <InfoItem label="Usia / Fase" value={usiaLabel(p)} />
            {p.tanggal_persalinan && <InfoItem label="Tgl Persalinan" value={fmtDate(p.tanggal_persalinan)} />}
          </div>
        </div>
        <div className={`${cardCls} ${p.status === "terlambat" ? "!border-red-300 !bg-red-50/40" : p.status === "hari_ini" ? "!border-rose-300 !bg-rose-50/40" : ""}`} data-testid="next-schedule-card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Jadwal Kontrol</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Kontrol Berikutnya" value={p.jadwal_berikutnya ? `${fmtDate(p.jadwal_berikutnya)} (${p.kunjungan_berikutnya})` : "Selesai"} />
            <InfoItem label="Kontrol Terakhir" value={fmtDate(p.kontrol_terakhir)} />
            <InfoItem label="Total Kontrol" value={`${p.jumlah_kontrol}x`} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</div>
              <div className="mt-1"><StatusBadge status={p.status} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Grafik Tekanan Darah</h3>
          {chartData.filter((c) => c.sistolik).length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-slate-400" data-testid="bp-chart-empty">Belum ada data tekanan darah</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} domain={[40, 180]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sistolik" name="Sistolik" stroke="#C02650" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="diastolik" name="Diastolik" stroke="#0F172A" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Grafik Berat Badan</h3>
          {chartData.filter((c) => c.berat_badan).length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-slate-400" data-testid="weight-chart-empty">Belum ada data berat badan</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} domain={["auto", "auto"]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="berat_badan" name="Berat Badan (kg)" stroke="#C02650" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Riwayat Kontrol</h2>
        </div>
        {checkups.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400" data-testid="checkups-empty-state">
            Belum ada catatan kontrol. Klik "Catat Kontrol" untuk menambahkan.
          </div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Kunjungan</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">TD (mmHg)</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">BB (kg)</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">TFU (cm)</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">DJJ</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Keluhan / Catatan</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...checkups].reverse().map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`checkup-row-${c.id}`}>
                  <td className="px-5 py-3 font-semibold text-slate-800">{fmtDate(c.tanggal)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${c.jenis === "kf" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
                      {c.jenis === "kf" ? `KF${c.ke}` : `K${c.ke}`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.sistolik && c.diastolik ? `${c.sistolik}/${c.diastolik}` : "-"}</td>
                  <td className="px-5 py-3 text-slate-600">{c.berat_badan ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-600">{c.tinggi_fundus ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-600">{c.djj ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-600 max-w-[220px]">
                    <div className="truncate">{c.keluhan || "-"}</div>
                    {c.catatan && <div className="text-xs text-slate-400 truncate">{c.catatan}</div>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      data-testid={`checkup-delete-button-${c.id}`}
                      onClick={() => deleteCheckup(c.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PatientForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} initial={p} />
      <CheckupForm open={checkupOpen} onClose={() => setCheckupOpen(false)} onSaved={load} patient={p} />
      <WaReminder open={waOpen} onClose={() => setWaOpen(false)} patient={p} bidanNama={user?.nama} />

      <Modal open={deliveryOpen} onClose={() => setDeliveryOpen(false)} title="Tandai Persalinan" testid="delivery-modal">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Setelah persalinan dicatat, pasien masuk <span className="font-semibold text-purple-700">fase nifas</span> dan jadwal kontrol berubah menjadi kunjungan KF1–KF4.</p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal Persalinan</label>
            <input
              data-testid="delivery-date-input"
              type="date"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
          <button
            data-testid="delivery-submit-button"
            onClick={saveDelivery}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            Simpan — Masuk Fase Nifas
          </button>
        </div>
      </Modal>
    </div>
  );
}
