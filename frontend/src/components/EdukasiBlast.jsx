import { useEffect, useMemo, useState } from "react";
import { Copy, Check, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import Modal from "./Modal";
import api from "../lib/api";
import { waUrl, usiaLabel } from "../lib/utils-id";
import { FaseBadge } from "./StatusBadge";

export default function EdukasiBlast({ open, onClose, fase, faseLabel, messages }) {
  const [patients, setPatients] = useState(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setPatients(null);
      api.get("/patients").then((r) => setPatients(r.data));
      setText(messages.map((m, i) => `${i + 1}. ${m.isi}`).join("\n\n"));
      setCopied(false);
    }
  }, [open, fase, messages]);

  const recipients = useMemo(() => {
    if (!patients) return [];
    return patients.filter((p) => {
      if (fase === "nifas") return p.fase === "nifas" && (p.hari_nifas ?? 0) <= 42;
      if (fase === "trimester_4") return p.fase === "nifas" && (p.hari_nifas ?? 0) > 42;
      return p.fase === fase;
    });
  }, [patients, fase]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Pesan edukasi disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin pesan");
    }
  };

  const kirim = (p) => {
    if (!text.trim()) {
      toast.error("Isi pesan masih kosong");
      return;
    }
    window.open(waUrl(p.no_wa, text), "_blank", "noopener,noreferrer");
  };

  return (
    <Modal open={open} onClose={onClose} title={`Kirim Edukasi ${faseLabel} ke WhatsApp`} testid="edukasi-blast-modal">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-600">Pesan Edukasi (gabungan chatbox, bisa diedit)</label>
            <button
              data-testid="edukasi-blast-copy"
              onClick={copy}
              className="flex items-center gap-1 text-xs font-semibold text-[#C02650] hover:underline"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <textarea
            data-testid="edukasi-blast-textarea"
            rows={7}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Belum ada isi edukasi di fase ini — tulis dulu di chatbox atau ketik manual di sini."
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600" data-testid="edukasi-blast-count">
              Penerima: {recipients.length} pasien fase {faseLabel}
            </span>
          </div>
          {!patients ? (
            <div className="text-sm text-slate-400 animate-pulse py-4">Memuat daftar pasien...</div>
          ) : recipients.length === 0 ? (
            <div className="px-4 py-6 rounded-xl bg-slate-50 border border-slate-100 text-center text-sm text-slate-400" data-testid="edukasi-blast-empty">
              Tidak ada pasien pada fase {faseLabel} saat ini.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {recipients.map((p) => (
                <div
                  key={p.id}
                  data-testid={`edukasi-blast-row-${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/60"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{p.nama}</div>
                    <div className="text-xs text-slate-400">{usiaLabel(p)} · {p.no_wa}</div>
                  </div>
                  <FaseBadge fase={p.fase} />
                  <button
                    data-testid={`edukasi-blast-send-${p.id}`}
                    onClick={() => kirim(p)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:bg-[#1eb85a] transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Kirim WA
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400">Klik "Kirim WA" pada tiap pasien — WhatsApp terbuka dengan pesan edukasi sudah terisi, tinggal tekan kirim.</p>
      </div>
    </Modal>
  );
}
