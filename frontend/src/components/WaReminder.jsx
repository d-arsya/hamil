import { useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "./Modal";
import api from "../lib/api";
import { fmtDate, sanitizePhone, usiaLabel, waUrl } from "../lib/utils-id";

const buildTemplates = (p, bidanNama) => {
  const bidan = /^bidan/i.test(bidanNama || "") ? bidanNama : `Bidan ${bidanNama}`;
  const anak = p.nama_anak ? p.nama_anak : `anak dari Ibu ${p.nama}`;
  const imu = p.imunisasi_berikutnya;
  return {
  rutin: `Halo Ibu ${p.nama}, salam sehat dari ${bidan}. Mengingatkan jadwal rutin kontrol ${p.fase === "nifas" ? "nifas" : "kehamilan"} Ibu (${usiaLabel(p)}) pada tanggal ${fmtDate(p.jadwal_berikutnya)}. Mohon datang tepat waktu untuk memantau kesehatan Ibu${p.fase === "nifas" ? " & si kecil" : " & janin"}. Terima kasih.`,
  terlambat: `Halo Ibu ${p.nama}, jadwal kontrol Ibu seharusnya pada ${fmtDate(p.jadwal_berikutnya)} dan sudah terlewat. Kesehatan Ibu dan si kecil sangat penting, yuk segera lakukan pemeriksaan dengan ${bidan}. Balas pesan ini jika ingin penjadwalan ulang.`,
  nifas: `Halo Ibu ${p.nama}, selamat atas kelahiran si buah hati! Mengingatkan jadwal kunjungan nifas (${p.kunjungan_berikutnya || "KF"}) pada ${fmtDate(p.jadwal_berikutnya)} untuk pemeriksaan pemulihan Ibu dan tumbuh kembang ${anak}. Ditunggu ya, Bu.`,
  imunisasi: imu
    ? `Halo Ibu ${p.nama}, mengingatkan jadwal imunisasi untuk ${anak}: ${imu.nama} pada tanggal ${fmtDate(imu.tanggal)} (usia ${imu.usia}). Imunisasi penting untuk melindungi si kecil dari penyakit berbahaya. Ditunggu kedatangannya ya, Bu. — ${bidan}`
    : `Halo Ibu ${p.nama}, seluruh jadwal imunisasi dasar ${anak} sudah tercatat. Tetap jaga kesehatan si kecil ya, Bu. — ${bidan}`,
  promo: `Halo Ibu ${p.nama}! Kabar gembira dari ${bidan}: kini tersedia layanan PIJAT BAYI untuk ${anak} — membantu si kecil tidur lebih nyenyak, pencernaan lancar, dan tumbuh kembang optimal. ${p.anc_lengkap ? "Dan karena kontrol kehamilan Ibu tercatat LENGKAP, Ibu berhak mendapat PROMO KHUSUS! " : ""}Yuk jadwalkan sesi pijat untuk ${anak}. Balas pesan ini untuk info harga & jadwal.`,
  };
};

export default function WaReminder({ open, onClose, patient, bidanNama, initialTemplate }) {
  const [templateKey, setTemplateKey] = useState("rutin");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [saveJudul, setSaveJudul] = useState("");

  const templates = useMemo(() => (patient ? buildTemplates(patient, bidanNama || "Kita") : {}), [patient, bidanNama]);

  useEffect(() => {
    if (open && patient) {
      const fallback = patient.fase === "nifas" ? "nifas" : patient.status === "terlambat" ? "terlambat" : "rutin";
      const def = initialTemplate && templates[initialTemplate] ? initialTemplate : fallback;
      setTemplateKey(def);
      setMessage(templates[def] || "");
      setCopied(false);
      setSaveJudul("");
      api.get("/templates").then((r) => setCustomTemplates(r.data)).catch(() => {});
    }
  }, [open, patient, templates, initialTemplate]);

  if (!patient) return null;

  const applyPlaceholders = (text) =>
    text
      .replaceAll("{nama}", patient.nama)
      .replaceAll("{anak}", patient.nama_anak || `anak dari Ibu ${patient.nama}`)
      .replaceAll("{jadwal}", fmtDate(patient.jadwal_berikutnya));

  const pickTemplate = (k) => {
    setTemplateKey(k);
    if (k.startsWith("custom:")) {
      const t = customTemplates.find((x) => `custom:${x.id}` === k);
      setMessage(applyPlaceholders(t?.isi || ""));
    } else {
      setMessage(templates[k]);
    }
    setCopied(false);
  };

  const saveTemplate = async () => {
    if (!saveJudul.trim() || !message.trim()) {
      toast.error("Isi judul dan pesan dulu");
      return;
    }
    try {
      await api.post("/templates", { judul: saveJudul.trim(), isi: message });
      toast.success("Template tersimpan — bisa dipakai lagi kapan saja");
      setSaveJudul("");
      const r = await api.get("/templates");
      setCustomTemplates(r.data);
    } catch {
      toast.error("Gagal menyimpan template");
    }
  };

  const deleteTemplate = async () => {
    const id = templateKey.replace("custom:", "");
    await api.delete(`/templates/${id}`);
    toast.success("Template dihapus");
    setCustomTemplates((s) => s.filter((t) => t.id !== id));
    setTemplateKey("rutin");
    setMessage(templates.rutin);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = message;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        toast.error("Gagal menyalin pesan — salin manual dari kotak pesan");
        return;
      }
    }
    setCopied(true);
    toast.success("Pesan disalin — tinggal paste di WhatsApp");
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    ["rutin", "Pengingat Rutin"],
    ["terlambat", "Terlambat Kontrol"],
    ["nifas", "Kunjungan Nifas"],
    ["imunisasi", "Imunisasi Bayi"],
    ["promo", "Promo Pijat Bayi"],
    ...customTemplates.map((t) => [`custom:${t.id}`, t.judul]),
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Kirim Pengingat WA — ${patient.nama}`} testid="wa-reminder-modal">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              data-testid={`wa-template-${k}`}
              onClick={() => pickTemplate(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                templateKey === k ? "bg-[#C02650] text-white border-[#C02650]" : "bg-white text-slate-600 border-slate-200 hover:border-[#C02650]/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Isi Pesan (bisa diedit)</label>
          <textarea
            data-testid="wa-message-textarea"
            rows={6}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setCopied(false);
            }}
          />
        </div>
        <div className="flex gap-2">
          <input
            data-testid="wa-template-judul"
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
            placeholder="Judul template untuk disimpan (cth: Promo paket imunisasi)"
            value={saveJudul}
            onChange={(e) => setSaveJudul(e.target.value)}
          />
          <button
            data-testid="wa-template-save"
            onClick={saveTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Simpan Template
          </button>
        </div>
        {templateKey.startsWith("custom:") && (
          <button data-testid="wa-template-delete" onClick={deleteTemplate} className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline">
            <Trash2 className="w-3.5 h-3.5" /> Hapus template ini
          </button>
        )}
        <p className="text-[11px] text-slate-400 -mt-1">Di template tersimpan, tulis {"{nama}"}, {"{anak}"}, atau {"{jadwal}"} untuk otomatis diganti data pasien saat dipilih.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            data-testid="wa-copy-button"
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? "Tersalin!" : "Salin Pesan"}
          </button>
          <a
            data-testid="wa-send-button"
            href={waUrl(patient.no_wa, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#25D366] text-white hover:bg-[#1eb85a] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Buka WhatsApp ({sanitizePhone(patient.no_wa)})
          </a>
        </div>
        <p className="text-[11px] text-slate-400">Tombol hijau membuka WhatsApp dengan pesan terisi otomatis. Atau salin pesan lalu paste manual di chat WA.</p>
      </div>
    </Modal>
  );
}
