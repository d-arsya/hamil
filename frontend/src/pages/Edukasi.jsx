import { useEffect, useRef, useState } from "react";
import { Send, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";

const TABS = [
  ["trimester_1", "Trimester 1"],
  ["trimester_2", "Trimester 2"],
  ["trimester_3", "Trimester 3"],
  ["trimester_4", "Trimester 4"],
  ["nifas", "Masa Nifas"],
];

export default function Edukasi() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("trimester_1");
  const [isi, setIsi] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => api.get("/edukasi").then((r) => setData(r.data));
  useEffect(() => {
    load();
  }, []);

  const messages = data?.[tab] || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, tab]);

  const send = async (e) => {
    e.preventDefault();
    if (!isi.trim()) return;
    setSending(true);
    try {
      await api.post(`/edukasi/${tab}`, { isi });
      setIsi("");
      load();
    } catch (err) {
      toast.error(apiError(err, "Gagal mengirim edukasi"));
    } finally {
      setSending(false);
    }
  };

  const del = async (msgId) => {
    if (!window.confirm("Hapus pesan edukasi ini?")) return;
    await api.delete(`/edukasi/${msgId}`);
    toast.success("Pesan dihapus");
    load();
  };

  return (
    <div data-testid="edukasi-page" className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-[#C02650] flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Edukasi Pasien</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tulis materi edukasi per fase kehamilan & nifas di sini.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            data-testid={`edukasi-tab-${k}`}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${
              tab === k ? "bg-[#C02650] text-white border-[#C02650]" : "bg-white text-slate-600 border-slate-200 hover:border-[#C02650]/50"
            }`}
          >
            {label}
            {data && <span className="ml-1.5 opacity-70">({data[k]?.length || 0})</span>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 flex flex-col" style={{ height: "60vh" }}>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3" data-testid="edukasi-message-list">
          {!data ? (
            <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center" data-testid="edukasi-empty-state">
              <div className="w-12 h-12 rounded-2xl bg-[#FDF2F5] flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6 text-[#C02650]" />
              </div>
              <div className="text-sm font-semibold text-slate-600">Belum ada edukasi untuk fase ini</div>
              <div className="text-xs text-slate-400 mt-1">Tulis pesan pertama lewat kotak di bawah.</div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="group flex items-start gap-2" data-testid={`edukasi-message-${m.id}`}>
                <div className="max-w-[85%] bg-[#FDF2F5] border border-rose-100 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{m.isi}</div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    {m.oleh} · {new Date(m.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <button
                  data-testid={`edukasi-delete-${m.id}`}
                  onClick={() => del(m.id)}
                  className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Hapus pesan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="border-t border-slate-100 px-4 py-3 flex gap-2">
          <input
            data-testid="edukasi-input"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors"
            placeholder={`Tulis edukasi untuk ${(TABS.find(([k]) => k === tab) || ["", "fase ini"])[1]}...`}
            value={isi}
            onChange={(e) => setIsi(e.target.value)}
          />
          <button
            type="submit"
            data-testid="edukasi-send-button"
            disabled={sending || !isi.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
}
