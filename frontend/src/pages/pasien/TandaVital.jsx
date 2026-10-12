import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import pasienApi from "../../lib/pasienApi";
import { fmtDate } from "../../lib/utils-id";

const card = "bg-white rounded-3xl border border-slate-200/80 p-5";

// Tanda vital dengan batas normal & edukasi — level: "bahaya" (merah), "waspada" (kuning), null = normal
const VITALS = [
  { key: "sistolik", label: "TD Sistolik", unit: "mmHg", normal: "di bawah 140",
    eval: (v) => v >= 160 ? { level: "bahaya", note: "Tekanan darah sangat tinggi — risiko preeklamsia berat. Segera hubungi bidan." } :
      v >= 140 ? { level: "waspada", note: "Tekanan darah tinggi — waspada hipertensi/preeklamsia. Kurangi garam, cukup istirahat, kontrol lebih cepat." } :
      v < 90 ? { level: "waspada", note: "Tekanan darah rendah — bisa menyebabkan pusing/lemas. Cukupi cairan, jangan berdiri mendadak." } : null },
  { key: "diastolik", label: "TD Diastolik", unit: "mmHg", normal: "di bawah 90",
    eval: (v) => v >= 110 ? { level: "bahaya", note: "Tekanan darah sangat tinggi — segera hubungi bidan." } :
      v >= 90 ? { level: "waspada", note: "Tekanan darah tinggi — waspada hipertensi dalam kehamilan." } :
      v < 60 ? { level: "waspada", note: "Tekanan darah rendah — cukupi cairan dan istirahat." } : null },
  { key: "suhu", label: "Suhu Tubuh", unit: "°C", normal: "36,0–37,5",
    eval: (v) => v >= 38 ? { level: "bahaya", note: "Demam tinggi — bisa menandakan infeksi. Segera periksakan diri." } :
      v >= 37.5 ? { level: "waspada", note: "Suhu sedikit naik — perbanyak minum air putih, kompres hangat, pantau ulang." } :
      v < 36 ? { level: "waspada", note: "Suhu tubuh rendah — hangatkan tubuh dan cukupi makan." } : null },
  { key: "nadi", label: "Denyut Nadi", unit: "x/menit", normal: "60–100",
    eval: (v) => v > 110 ? { level: "bahaya", note: "Denyut nadi sangat cepat — segera hubungi bidan." } :
      v > 100 ? { level: "waspada", note: "Denyut nadi cepat — istirahat sejenak, cukupi cairan." } :
      v < 60 ? { level: "waspada", note: "Denyut nadi lambat — bila disertai pusing, periksakan diri." } : null },
  { key: "rr", label: "Pernapasan", unit: "x/menit", normal: "12–20",
    eval: (v) => v > 24 ? { level: "bahaya", note: "Pernapasan sangat cepat — segera hubungi bidan." } :
      v > 20 ? { level: "waspada", note: "Pernapasan lebih cepat dari normal — duduk santai, atur napas." } :
      v < 12 ? { level: "waspada", note: "Pernapasan lambat — bila disertai sesak, periksakan diri." } : null },
  { key: "spo2", label: "Saturasi Oksigen (SpO2)", unit: "%", normal: "95–100",
    eval: (v) => v < 90 ? { level: "bahaya", note: "Oksigen darah rendah — kondisi gawat, segera ke fasilitas kesehatan." } :
      v < 95 ? { level: "waspada", note: "Saturasi oksigen sedikit rendah — duduk tegak, tarik napas dalam, pantau ulang." } : null },
  { key: "lila", label: "Lingkar Lengan Atas (LiLa)", unit: "cm", normal: "23,5 ke atas",
    eval: (v) => v < 23.5 ? { level: "waspada", note: "LiLa di bawah 23,5 cm — risiko Kurang Energi Kronis (KEK). Tingkatkan asupan gizi dan rutin minum TTD/MMS." } : null },
];

const HANYA_TAMPIL = [
  { key: "berat_badan", label: "Berat Badan", unit: "kg" },
  { key: "tfu", label: "Tinggi Fundus", unit: "cm" },
  { key: "tinggi_badan", label: "Tinggi Badan", unit: "cm" },
];

export default function TandaVital() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    pasienApi.get("/pasien/ttv").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);

  if (!rows) return <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>;

  const flagsOf = (row) => VITALS.map((v) => (row[v.key] != null ? v.eval(Number(row[v.key])) : null)).filter(Boolean);
  const latest = rows[0];
  const latestFlags = latest ? flagsOf(latest) : [];
  const bahaya = latestFlags.some((f) => f.level === "bahaya");

  return (
    <div className="space-y-4" data-testid="ttv-page">
      <h1 className="text-xl font-extrabold text-slate-900">Tanda Vital Saya</h1>
      <p className="text-xs text-slate-500 -mt-2">Hasil pengukuran bidan saat kontrol, beserta artinya untuk Ibu.</p>

      {latest && (
        <div className={`${card} ${bahaya ? "!border-red-300 !bg-red-50" : latestFlags.length ? "!border-amber-200 !bg-amber-50" : "!border-emerald-200 !bg-emerald-50"}`} data-testid="ttv-status-terkini">
          <div className="flex items-center gap-2 text-sm font-bold">
            {bahaya || latestFlags.length > 0
              ? <AlertTriangle className={`w-5 h-5 ${bahaya ? "text-red-600" : "text-amber-600"}`} />
              : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            <span className={bahaya ? "text-red-700" : latestFlags.length ? "text-amber-700" : "text-emerald-700"}>
              {bahaya ? "Ada hasil yang perlu segera ditangani" : latestFlags.length ? "Ada hasil yang perlu diwaspadai" : "Semua tanda vital baik"}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Pengukuran terakhir: {fmtDate(latest.tanggal)}</div>
        </div>
      )}

      {rows.length === 0 && (
        <div className={`${card} text-center text-sm text-slate-400 py-8`} data-testid="ttv-empty">
          Belum ada data tanda vital. Data akan muncul setelah bidan mencatat kontrol.
        </div>
      )}

      {rows.map((row) => (
        <div key={`${row.tanggal}-${row.jenis}-${row.ke}`} className={card} data-testid={`ttv-record-${row.tanggal}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-slate-900">{fmtDate(row.tanggal)}</div>
            {row.ke != null && (
              <span className="px-2 py-0.5 rounded-full bg-[#FDF2F5] text-[#C02650] border border-rose-100 text-[10px] font-bold">
                {row.jenis === "anc" ? `K${row.ke}` : `KF${row.ke}`}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {VITALS.map((v) => {
              const val = row[v.key];
              if (val == null) return null;
              const flag = v.eval(Number(val));
              const cls = flag?.level === "bahaya" ? "border-red-300 bg-red-50" : flag ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-slate-50";
              return (
                <div key={v.key} className={`px-3.5 py-2.5 rounded-2xl border ${cls}`} data-testid={`ttv-${v.key}-${row.tanggal}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{v.label}</span>
                    <span className="font-extrabold text-slate-900">{val} <span className="text-[10px] font-semibold text-slate-400">{v.unit}</span></span>
                  </div>
                  <div className={`text-[11px] mt-0.5 font-semibold leading-relaxed ${flag?.level === "bahaya" ? "text-red-700" : flag ? "text-amber-700" : "text-emerald-600"}`}>
                    {flag ? flag.note : `Normal (batas: ${v.normal})`}
                  </div>
                </div>
              );
            })}
            {HANYA_TAMPIL.map((v) => row[v.key] != null && (
              <div key={v.key} className="flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-100" data-testid={`ttv-${v.key}-${row.tanggal}`}>
                <span className="text-slate-500">{v.label}</span>
                <span className="font-bold text-slate-800">{row[v.key]} {v.unit}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className={card} data-testid="ttv-edukasi">
        <h2 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5"><Info className="w-4 h-4 text-[#C02650]" /> Kenali Tanda Vital</h2>
        <ul className="space-y-1.5 text-xs text-slate-500 leading-relaxed">
          <li>• <b>Tekanan darah</b>: normal di bawah 140/90 mmHg. Sering tinggi bisa menjadi tanda preeklamsia.</li>
          <li>• <b>Suhu</b>: normal 36–37,5°C. Demam saat hamil perlu diperiksakan.</li>
          <li>• <b>Nadi & pernapasan</b>: normal 60–100 dan 12–20 kali per menit.</li>
          <li>• <b>SpO2</b>: normal 95–100%. Di bawah itu berarti kadar oksigen darah kurang.</li>
          <li>• <b>LiLa</b>: di bawah 23,5 cm menandakan risiko kekurangan gizi kronis (KEK).</li>
          <li>• Jika ada tanda merah/kuning yang berulang, gunakan menu <b>Janji Temu</b> untuk menghubungi bidan.</li>
        </ul>
      </div>
    </div>
  );
}
