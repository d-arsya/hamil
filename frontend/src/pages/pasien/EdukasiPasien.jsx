import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { EDUKASI_KATEGORI, EDUKASI_ARTIKEL } from "../../lib/konten";

export default function EdukasiPasien() {
  const [kategori, setKategori] = useState(null);

  if (kategori) {
    const artikel = EDUKASI_ARTIKEL[kategori.key] || [];
    return (
      <div className="space-y-3" data-testid="edukasi-detail">
        <button onClick={() => setKategori(null)} data-testid="edukasi-back" className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <h1 className="text-xl font-extrabold text-slate-900">{kategori.icon} {kategori.label}</h1>
        {artikel.map((a) => (
          <div key={a.judul} className="bg-white rounded-3xl border border-slate-200/80 p-5">
            <div className="text-sm font-bold text-slate-900 mb-1.5">{a.judul}</div>
            <div className="text-sm text-slate-600 leading-relaxed">{a.isi}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="edukasi-page-pasien">
      <h1 className="text-xl font-extrabold text-slate-900">Edukasi</h1>

      <div className="grid grid-cols-3 gap-2">
        {EDUKASI_KATEGORI.map((k) => (
          <button
            key={k.key}
            data-testid={`edukasi-kategori-${k.key}`}
            onClick={() => setKategori(k)}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="text-2xl">{k.icon}</span>
            <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{k.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 text-center">Materi ringkas berdasarkan Buku KIA.</p>
    </div>
  );
}
