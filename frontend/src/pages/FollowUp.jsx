import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, Check, MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import StatusBadge, { FaseBadge } from "../components/StatusBadge";
import { fmtDate, waUrl } from "../lib/utils-id";

const cardCls = "bg-white rounded-xl border border-slate-200/80 p-5";

export default function FollowUp() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [peng, setPeng] = useState(null);
  const [editTemplate, setEditTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/followup").then((r) => setData(r.data));
  useEffect(() => {
    load();
    api.get("/pengaturan").then((r) => setPeng(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-sm text-slate-400 animate-pulse" data-testid="followup-loading">Memuat daftar follow-up...</div>;

  const bidan = user?.nama ? (/^bidan/i.test(user.nama) ? user.nama : `Bidan ${user.nama}`) : "Bidan";
  const renderPesan = (p) =>
    (data.template || "")
      .replaceAll("{nama}", p.nama)
      .replaceAll("{kunjungan}", p.kunjungan_berikutnya || "kontrol")
      .replaceAll("{jadwal}", fmtDate(p.jadwal_berikutnya))
      .replaceAll("{bidan}", bidan);

  const kirim = async (p) => {
    try {
      await api.post(`/followup/${p.id}`);
      window.open(waUrl(p.no_wa, renderPesan(p)), "_blank");
      toast.success(`${p.nama} ditandai sudah di-follow up minggu ini`);
      load();
    } catch (err) {
      toast.error(apiError(err, "Gagal menandai follow-up"));
    }
  };

  const simpanTemplate = async () => {
    setSaving(true);
    try {
      await api.put("/pengaturan", { ...peng, template_followup: peng.template_followup });
      toast.success("Template follow-up tersimpan");
      setEditTemplate(false);
      load();
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan template"));
    } finally {
      setSaving(false);
    }
  };

  const belum = data.items.filter((p) => !p.sudah_followup);
  const sudah = data.items.filter((p) => p.sudah_followup);

  return (
    <div data-testid="followup-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-[#C02650] flex items-center justify-center">
          <BellRing className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Follow-Up Mingguan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Minggu {data.minggu} · kirim pengingat kontrol ke semua pasien aktif via WA, lalu otomatis ditandai.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={cardCls} data-testid="followup-stat-total">
          <div className="text-2xl font-extrabold text-slate-900">{data.items.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Pasien Aktif</div>
        </div>
        <div className={cardCls} data-testid="followup-stat-belum">
          <div className="text-2xl font-extrabold text-amber-600">{belum.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Belum Di-Follow Up</div>
        </div>
        <div className={cardCls} data-testid="followup-stat-sudah">
          <div className="text-2xl font-extrabold text-emerald-600">{sudah.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Sudah Di-Follow Up</div>
        </div>
      </div>

      <div className={`${cardCls} mb-6`} data-testid="followup-template-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Template Pesan Pengingat Kontrol</h3>
          <button data-testid="followup-template-edit" onClick={() => setEditTemplate((v) => !v)} className="text-xs font-bold text-[#C02650] hover:underline">
            {editTemplate ? "Tutup" : "Edit Template"}
          </button>
        </div>
        {editTemplate ? (
          <div className="space-y-2">
            <textarea
              data-testid="followup-template-input"
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
              value={peng?.template_followup || ""}
              onChange={(e) => setPeng((s) => ({ ...s, template_followup: e.target.value }))}
            />
            <p className="text-[11px] text-slate-400">Placeholder: {"{nama}"} {"{kunjungan}"} {"{jadwal}"} {"{bidan}"} — otomatis diganti data pasien saat kirim.</p>
            <button
              data-testid="followup-template-save"
              onClick={simpanTemplate}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? "Menyimpan..." : "Simpan Template"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-100" data-testid="followup-template-preview">{data.template}</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Pasien</th>
              <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Fase</th>
              <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Jadwal Kontrol</th>
              <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.items.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400" data-testid="followup-empty">Tidak ada pasien aktif.</td></tr>
            )}
            {data.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`followup-row-${p.id}`}>
                <td className="px-5 py-3.5">
                  <Link to={`/pasien/${p.id}`} className="font-bold text-slate-900 hover:text-[#C02650] hover:underline transition-colors">{p.nama}</Link>
                  {p.prioritas && !p.sudah_followup && (
                    <span data-testid={`followup-prioritas-${p.id}`} className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">Jatuh tempo / terlambat</span>
                  )}
                </td>
                <td className="px-5 py-3.5"><FaseBadge fase={p.fase} /></td>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-slate-800">{fmtDate(p.jadwal_berikutnya)}</div>
                  <div className="text-xs text-slate-400">{p.kunjungan_berikutnya ? `Kunjungan ${p.kunjungan_berikutnya}` : "-"}</div>
                </td>
                <td className="px-5 py-3.5">
                  {p.sudah_followup ? (
                    <span data-testid={`followup-done-${p.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <Check className="w-3 h-3" /> Sudah di-follow up
                    </span>
                  ) : (
                    <StatusBadge status={p.status} />
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    data-testid={`followup-send-${p.id}`}
                    onClick={() => kirim(p)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                      p.sudah_followup
                        ? "border border-slate-200 text-slate-500 hover:bg-slate-50"
                        : "bg-[#25D366] text-white hover:bg-[#1eb85a]"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {p.sudah_followup ? "Kirim Ulang" : "Kirim WA & Tandai"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
