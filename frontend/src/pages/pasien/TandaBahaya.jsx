import { AlertTriangle, Phone } from "lucide-react";
import { usePasien } from "./PasienLayout";
import { TANDA_BAHAYA, FASE_LABEL } from "../../lib/konten";

export default function TandaBahaya() {
  const { me } = usePasien();
  const p = me.pasien;
  const items = TANDA_BAHAYA[p.fase] || TANDA_BAHAYA.trimester_1;
  const kontak = p.kontak_darurat ? p.kontak_darurat.replace(/\D/g, "") : null;

  return (
    <div className="space-y-4" data-testid="bahaya-page">
      <div className="bg-red-600 rounded-3xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-6 h-6" />
          <h1 className="text-lg font-extrabold">Tanda Bahaya Kehamilan</h1>
        </div>
        <p className="text-white/85 text-xs">{FASE_LABEL[p.fase]} · Jika Ibu mengalami salah satunya, jangan menunggu — segera periksa.</p>
      </div>

      <div className="space-y-2">
        {items.map((t, i) => (
          <div key={t} className="bg-white rounded-2xl border border-red-100 p-4 flex items-center gap-3" data-testid={`bahaya-item-${i}`}>
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-sm font-bold text-slate-800">{t}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed bg-white rounded-2xl border border-slate-200/80 p-4">
        Keluhan di atas memerlukan perhatian. Segera periksa ke fasilitas pelayanan kesehatan terdekat (Puskesmas, klinik bidan, atau Rumah Sakit).
      </p>

      {kontak && (
        <a href={`tel:${kontak}`} data-testid="bahaya-call-button"
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-base font-bold bg-red-600 text-white active:scale-95 transition-transform">
          <Phone className="w-5 h-5" />
          HUBUNGI FASILITAS KESEHATAN
        </a>
      )}
    </div>
  );
}
