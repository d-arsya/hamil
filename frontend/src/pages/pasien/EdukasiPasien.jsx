import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircleHeart } from "lucide-react";
import pasienApi from "../../lib/pasienApi";
import { EDUKASI_KATEGORI, EDUKASI_ARTIKEL } from "../../lib/konten";

export default function EdukasiPasien() {
  const [kategori, setKategori] = useState(null);
  const [pesan, setPesan] = useState([]);

  useEffect(() => {
    pasienApi.get("/pasien/edukasi-klinik").then((r) => setPesan(r.data.pesan)).catch(() => {});
  }, []);

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

      {pesan.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5" data-testid="edukasi-pesan-bidan">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircleHeart className="w-4 h-4 text-[#C02650]" />
            <span className="text-sm font-bold text-slate-900">Pesan dari Bidan Ibu</span>
          </div>
          <div className="space-y-2">
            {pesan.map((m) => (
              <div key={m.id} className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-[#FDF2F5] border border-rose-100 text-sm text-slate-700 leading-relaxed">{m.isi}</div>
            ))}
          </div>
        </div>
      )}

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
