export const STATUS_STYLES = {
  sudah_kontrol: ["Sudah Kontrol", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  hari_ini: ["Kontrol Hari Ini", "bg-rose-50 text-rose-700 border-rose-200"],
  mendekati: ["Mendekati Jadwal", "bg-amber-50 text-amber-700 border-amber-200"],
  terlambat: ["Terlambat", "bg-red-100 text-red-700 border-red-300 font-bold"],
  terjadwal: ["Terjadwal", "bg-slate-50 text-slate-600 border-slate-200"],
  selesai: ["Selesai", "bg-slate-100 text-slate-500 border-slate-200"],
};

export const FASE_STYLES = {
  trimester_1: ["Trimester 1", "bg-sky-50 text-sky-700 border-sky-200"],
  trimester_2: ["Trimester 2", "bg-indigo-50 text-indigo-700 border-indigo-200"],
  trimester_3: ["Trimester 3", "bg-rose-50 text-rose-700 border-rose-200"],
  nifas: ["Nifas", "bg-purple-50 text-purple-700 border-purple-200"],
};

export default function StatusBadge({ status }) {
  const [label, cls] = STATUS_STYLES[status] || [status, "bg-slate-50 text-slate-600 border-slate-200"];
  return (
    <span data-testid={`status-badge-${status}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

export function FaseBadge({ fase }) {
  const [label, cls] = FASE_STYLES[fase] || [fase, "bg-slate-50 text-slate-600 border-slate-200"];
  return (
    <span data-testid={`fase-badge-${fase}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}
