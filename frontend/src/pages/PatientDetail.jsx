import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Baby, ClipboardPlus, MessageCircle, Pencil, Trash2, Gift, Check,
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import api, { apiError } from "../lib/api";
import StatusBadge, { FaseBadge, RiskBadges, riskNameColor } from "../components/StatusBadge";
import PatientForm from "../components/PatientForm";
import CheckupForm from "../components/CheckupForm";
import WaReminder from "../components/WaReminder";
import Timeline from "../components/Timeline";
import ImunisasiPanel from "../components/ImunisasiPanel";
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
  const emptyDelivery = { tanggal: "", nama_anak: "", jenis_kelamin_anak: "", cara_lahir: "", tempat_lahir: "", penolong_persalinan: "", masalah_persalinan: "" };
  const [deliveryData, setDeliveryData] = useState(emptyDelivery);
  const [waTemplate, setWaTemplate] = useState(null);

  const load = () => api.get(`/patients/${id}`).then((r) => setData(r.data)).catch(() => navigate("/pasien"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <div className="text-sm text-slate-400 animate-pulse" data-testid="patient-detail-loading">Memuat data pasien...</div>;

  const { pasien: p, checkups } = data;

  const saveDelivery = async () => {
    if (!deliveryData.tanggal) {
      toast.error("Pilih tanggal persalinan");
      return;
    }
    try {
      await api.put(`/patients/${p.id}/persalinan`, {
        tanggal_persalinan: deliveryData.tanggal,
        nama_anak: deliveryData.nama_anak,
        jenis_kelamin_anak: deliveryData.jenis_kelamin_anak,
        cara_lahir: deliveryData.cara_lahir,
        tempat_lahir: deliveryData.tempat_lahir,
        penolong_persalinan: deliveryData.penolong_persalinan,
        masalah_persalinan: deliveryData.masalah_persalinan,
      });
      toast.success("Persalinan dicatat — pasien masuk fase nifas");
      setDeliveryOpen(false);
      load();
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan tanggal persalinan"));
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

  const toggleKupon = async () => {
    try {
      await api.put(`/patients/${p.id}/kupon`, { diklaim: !p.kupon_diklaim });
      toast.success(p.kupon_diklaim ? "Klaim kupon dibatalkan" : "Kupon ditandai sudah dipakai");
      load();
    } catch {
      toast.error("Gagal memperbarui status kupon");
    }
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
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${riskNameColor(p.penyakit_penyerta) || "text-slate-900"}`} data-testid="patient-name">{p.nama}</h1>
            <FaseBadge fase={p.fase} />
            <StatusBadge status={p.status} />
            <RiskBadges penyakit={p.penyakit_penyerta} testidPrefix="risk-detail" />
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
              onClick={() => {
                setDeliveryData(emptyDelivery);
                setDeliveryOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <Baby className="w-4 h-4" /> Tandai Persalinan
            </button>
          )}
          {p.fase === "nifas" && (
            <button
              data-testid="edit-delivery-button"
              onClick={() => {
                setDeliveryData({
                  tanggal: p.tanggal_persalinan || "",
                  nama_anak: p.nama_anak || "",
                  jenis_kelamin_anak: p.jenis_kelamin_anak || "",
                  cara_lahir: p.cara_lahir || "",
                  tempat_lahir: p.tempat_lahir || "",
                  penolong_persalinan: p.penolong_persalinan || "",
                  masalah_persalinan: p.masalah_persalinan || "",
                });
                setDeliveryOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <Pencil className="w-4 h-4" /> Edit Persalinan
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

      {p.kupon_eligible && (
        <div
          data-testid="kupon-banner"
          className={`flex flex-wrap items-center gap-3 mb-6 px-5 py-4 rounded-xl border ${
            p.kupon_diklaim ? "bg-slate-50 border-slate-200" : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.kupon_diklaim ? "bg-slate-200 text-slate-500" : "bg-emerald-600 text-white"}`}>
            <Gift className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <div className={`text-sm font-bold ${p.kupon_diklaim ? "text-slate-600" : "text-emerald-800"}`}>
                Kupon Pijat Bayi Gratis 1x
              </div>
              {p.kupon_diklaim && (
                <span data-testid="kupon-status-pill" className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                  Sudah Dipakai
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {p.kupon_diklaim
                ? "Kupon sudah ditandai terpakai."
                : "Pasien berhak mendapat kupon karena kontrol kehamilan lebih dari 5 kali."}
            </div>
          </div>
          <button
            data-testid="kupon-claim-button"
            onClick={toggleKupon}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              p.kupon_diklaim
                ? "border border-slate-300 text-slate-600 hover:bg-slate-100"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            {p.kupon_diklaim ? "Batalkan Klaim" : "Tandai Sudah Dipakai"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className={cardCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Data Pasien</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Usia" value={p.usia_tahun != null ? `${p.usia_tahun} tahun` : "-"} />
            <InfoItem label="No. WhatsApp" value={p.no_wa} />
            <InfoItem label="Alamat" value={p.alamat} />
            <InfoItem label="Penyakit Penyerta" value={p.penyakit_penyerta} />
            <InfoItem label="Keluhan Utama" value={p.keluhan_utama} />
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
            {p.tanggal_persalinan && (
              <>
                <InfoItem label="Nama Anak" value={p.nama_anak || `Anak dari Ibu ${p.nama}`} />
                <InfoItem label="Jenis Kelamin Anak" value={p.jenis_kelamin_anak} />
                <InfoItem label="Cara Lahir" value={p.cara_lahir} />
                <InfoItem label="Tempat Lahir" value={p.tempat_lahir} />
                <InfoItem label="Penolong Persalinan" value={p.penolong_persalinan} />
                <InfoItem label="Masalah Saat Persalinan" value={p.masalah_persalinan} />
              </>
            )}
          </div>
          {p.riwayat_kehamilan?.length > 0 && (
            <div className="col-span-2 mt-1 pt-3 border-t border-slate-100">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Riwayat Kehamilan Sebelumnya</div>
              <div className="space-y-1.5" data-testid="riwayat-list">
                {p.riwayat_kehamilan.map((r, i) => (
                  <div key={i} className="text-xs text-slate-600 flex flex-wrap gap-x-2" data-testid={`riwayat-item-${i}`}>
                    <span className="font-semibold">{r.tahun || "-"}</span>
                    <span>· {r.hasil || "-"}</span>
                    {r.cara_lahir && <span>· {r.cara_lahir}</span>}
                    <span>· di {r.tempat || "-"}</span>
                    <span>· oleh {r.penolong || "-"}</span>
                    {r.penyulit && r.penyulit !== "Tidak ada" && (
                      <span className="text-red-600 font-semibold">· penyulit: {r.penyulit}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className={`${cardCls} ${p.status === "terlambat" ? "!border-red-300 !bg-red-50/40" : p.status === "hari_ini" ? "!border-rose-300 !bg-rose-50/40" : ""}`} data-testid="next-schedule-card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Jadwal Kontrol</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Kontrol Berikutnya" value={p.jadwal_berikutnya ? `${fmtDate(p.jadwal_berikutnya)} (${p.kunjungan_berikutnya})` : "Selesai"} />
            <InfoItem label="Kontrol Terakhir" value={fmtDate(p.kontrol_terakhir)} />
            <InfoItem label="Total Kontrol" value={`${p.jumlah_kontrol}x`} />
            <InfoItem label="Rencana Tindak Lanjut" value={p.rtl_berikutnya} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</div>
              <div className="mt-1"><StatusBadge status={p.status} /></div>
            </div>
          </div>
        </div>
      </div>

      <Timeline timeline={data.timeline} />

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

      <ImunisasiPanel patient={p} onRemind={() => { setWaTemplate("imunisasi"); setWaOpen(true); }} />

      <div className="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2.5">
          <h2 className="text-base font-bold text-slate-900">Riwayat Kontrol</h2>
          <RiskBadges penyakit={p.penyakit_penyerta} testidPrefix="risk-riwayat" />
          {riskNameColor(p.penyakit_penyerta) && (
            <span className="text-[11px] text-slate-400">— pasien risiko, tandai saat pemeriksaan</span>
          )}
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
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tindak Lanjut</th>
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
                  <td className="px-5 py-3 text-slate-600 max-w-[200px]">
                    {c.rencana_tindak_lanjut && (
                      <div className="text-xs font-semibold text-slate-700 truncate" title={c.rencana_tindak_lanjut}>RTL: {c.rencana_tindak_lanjut}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {c.jenis_kb && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold">
                          KB: {c.jenis_kb}{c.kontrol_kb ? " (kontrol rutin)" : ""}
                        </span>
                      )}
                      {c.imunisasi_diberikan && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-semibold">Imunisasi: {c.imunisasi_diberikan}</span>
                      )}
                    </div>
                    {!c.rencana_tindak_lanjut && !c.jenis_kb && !c.imunisasi_diberikan && "-"}
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
      <WaReminder open={waOpen} onClose={() => { setWaOpen(false); setWaTemplate(null); }} patient={p} bidanNama={user?.nama} initialTemplate={waTemplate} />

      <Modal open={deliveryOpen} onClose={() => setDeliveryOpen(false)} title={p.tanggal_persalinan ? "Edit Data Persalinan & Bayi" : "Tandai Persalinan"} testid="delivery-modal">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Setelah persalinan dicatat, pasien masuk <span className="font-semibold text-purple-700">fase nifas</span> dan jadwal kontrol berubah menjadi kunjungan KF1–KF4.</p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal Persalinan *</label>
            <input
              data-testid="delivery-date-input"
              type="date"
              min={p.hpht}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
              value={deliveryData.tanggal}
              onChange={(e) => setDeliveryData((d) => ({ ...d, tanggal: e.target.value }))}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Harus antara HPHT ({fmtDate(p.hpht)}) dan hari ini. Jika tanggal lahir bayi sebenarnya sebelum HPHT, periksa kembali tanggal HPHT pasien lewat tombol Edit.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Anak</label>
              <input
                data-testid="delivery-nama-anak"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
                value={deliveryData.nama_anak}
                onChange={(e) => setDeliveryData((d) => ({ ...d, nama_anak: e.target.value }))}
                placeholder="Kosongkan jika belum diberi nama"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jenis Kelamin Anak</label>
              <select
                data-testid="delivery-jenis-kelamin"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors bg-white"
                value={deliveryData.jenis_kelamin_anak}
                onChange={(e) => setDeliveryData((d) => ({ ...d, jenis_kelamin_anak: e.target.value }))}
              >
                <option value="">Pilih...</option>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lahir Secara</label>
              <select
                data-testid="delivery-cara-lahir"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors bg-white"
                value={deliveryData.cara_lahir}
                onChange={(e) => setDeliveryData((d) => ({ ...d, cara_lahir: e.target.value }))}
              >
                <option value="">Pilih...</option>
                <option>Normal / Spontan</option>
                <option>Sectio Caesaria (SC)</option>
                <option>Vakum / Forceps</option>
                <option>Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tempat Lahir</label>
              <input
                data-testid="delivery-tempat-lahir"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
                value={deliveryData.tempat_lahir}
                onChange={(e) => setDeliveryData((d) => ({ ...d, tempat_lahir: e.target.value }))}
                placeholder="cth: RSUD, Puskesmas, Rumah"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ditolong Oleh (Nakes)</label>
            <input
              data-testid="delivery-penolong"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
              value={deliveryData.penolong_persalinan}
              onChange={(e) => setDeliveryData((d) => ({ ...d, penolong_persalinan: e.target.value }))}
              placeholder="cth: Bidan Ani / dr. Budi SpOG"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Permasalahan Saat Persalinan</label>
            <textarea
              data-testid="delivery-masalah"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
              value={deliveryData.masalah_persalinan}
              onChange={(e) => setDeliveryData((d) => ({ ...d, masalah_persalinan: e.target.value }))}
              placeholder="cth: perdarahan, partus lama — kosongkan jika tidak ada"
            />
          </div>
          <button
            data-testid="delivery-submit-button"
            onClick={saveDelivery}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            {p.tanggal_persalinan ? "Simpan Perubahan" : "Simpan — Masuk Fase Nifas"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
