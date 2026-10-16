import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Activity, Pill, Baby, ClipboardList } from "lucide-react";
import api from "../lib/api";

const ICONS = { pantau: Activity, mingguan: ClipboardList, ttd: Pill, gerakan: Baby };
const LEVEL_CLS = {
  bahaya: "border-red-300 bg-red-50",
  waspada: "border-amber-300 bg-amber-50",
  info: "border-slate-200 bg-white",
};

function relatif(iso) {
  if (!iso) return "";
  const menit = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

export default function NotifikasiBell() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  const load = useCallback(() => api.get("/notifikasi").then((r) => setData(r.data)).catch(() => {}), []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const tutup = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", tutup);
    return () => document.removeEventListener("mousedown", tutup);
  }, []);

  const buka = () => {
    const akanTerbuka = !open;
    setOpen(akanTerbuka);
    if (akanTerbuka && (data?.unread || 0) > 0) {
      api.post("/notifikasi/read").then(() => setData((d) => (d ? { ...d, unread: 0 } : d))).catch(() => {});
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="notif-bell-button"
        onClick={buka}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        title="Notifikasi pemantauan pasien"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {(data?.unread || 0) > 0 && (
          <span
            data-testid="notif-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notif-panel"
          className="absolute right-0 mt-2 w-[92vw] max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-900">Pemantauan Mandiri Pasien</div>
            <div className="text-[10px] text-slate-400">7 hari terakhir · diperbarui tiap 30 dtk</div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {!data ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400 animate-pulse">Memuat...</div>
            ) : data.items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400" data-testid="notif-empty">
                Belum ada isian dari pasien dalam 7 hari terakhir.
              </div>
            ) : (
              data.items.map((n, i) => {
                const Icon = ICONS[n.tipe] || Activity;
                return (
                  <button
                    key={`${n.tipe}-${n.patient_id}-${n.waktu}-${i}`}
                    data-testid={`notif-item-${i}`}
                    onClick={() => {
                      setOpen(false);
                      navigate(`/pasien/${n.patient_id}`);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors border-l-4 ${LEVEL_CLS[n.level]}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${n.level === "bahaya" ? "bg-red-100" : n.level === "waspada" ? "bg-amber-100" : "bg-slate-100"}`}>
                        <Icon className={`w-3.5 h-3.5 ${n.level === "bahaya" ? "text-red-600" : n.level === "waspada" ? "text-amber-600" : "text-slate-500"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">{n.nama}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{relatif(n.waktu)}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">{n.judul}</div>
                        <div className={`text-[11px] leading-snug ${n.level === "bahaya" ? "text-red-700 font-semibold" : "text-slate-500"}`}>{n.ringkasan}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
