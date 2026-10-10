import { useEffect, useState } from "react";
import { CalendarClock, MessageCircle } from "lucide-react";
import pasienApi from "../../lib/pasienApi";
import { fmtDate, waUrl } from "../../lib/utils-id";

const card = "bg-white rounded-3xl border border-slate-200/80 p-5";

export default function Janji() {
  const [data, setData] = useState(null);

  useEffect(() => {
    pasienApi.get("/pasien/janji").then((r) => setData(r.data)).catch(() => setData({ wa_bidan: "", pesan: "" }));
  }, []);

  if (!data) return <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>;

  return (
    <div className="space-y-4" data-testid="janji-page">
      <h1 className="text-xl font-extrabold text-slate-900">Janji Temu / Kontrol</h1>

      {data.jadwal_berikutnya && (
        <div className={`${card} ${data.selisih_hari != null && data.selisih_hari < 0 ? "!border-red-300 !bg-red-50" : "!border-amber-200 !bg-amber-50"}`} data-testid="janji-jadwal-card">
          <div className="flex items-center gap-3">
            <CalendarClock className={`w-6 h-6 shrink-0 ${data.selisih_hari != null && data.selisih_hari < 0 ? "text-red-600" : "text-amber-600"}`} />
            <div className="text-sm">
              <b>Jadwal kontrol berikutnya: {fmtDate(data.jadwal_berikutnya)}</b>
              <div className="text-xs text-slate-500">
                {data.kunjungan_berikutnya} ·{" "}
                {data.selisih_hari != null && data.selisih_hari < 0
                  ? `Terlambat ${-data.selisih_hari} hari — segera buat janji ya, Bu`
                  : data.selisih_hari === 0
                    ? "Jatuh tempo hari ini"
                    : `${data.selisih_hari} hari lagi`}
              </div>
            </div>
          </div>
        </div>
      )}

      {data.wa_bidan ? (
        <>
          <div className={card}>
            <div className="text-xs font-semibold text-slate-500 mb-2">Pesan yang akan terkirim:</div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-[#E8F8EE] border border-emerald-100 text-sm text-slate-700 leading-relaxed" data-testid="janji-pesan-preview">
              {data.pesan}
            </div>
          </div>
          <a
            data-testid="janji-wa-button"
            href={waUrl(data.wa_bidan, data.pesan)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-bold bg-[#25D366] text-white active:scale-[0.98] transition-transform"
          >
            <MessageCircle className="w-5 h-5" />
            Buat Janji via WhatsApp
          </a>
          <p className="text-[11px] text-slate-400 text-center">Sekali klik — langsung terhubung ke WhatsApp bidan dengan pesan sudah terisi.</p>
        </>
      ) : (
        <div className={card} data-testid="janji-no-wa">
          <p className="text-sm text-slate-500 text-center py-4">
            Nomor WhatsApp bidan belum diatur. Silakan minta bidan mengisi nomor WA di menu Profil pada aplikasi klinik.
          </p>
        </div>
      )}
    </div>
  );
}
