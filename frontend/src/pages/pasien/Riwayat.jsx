import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import pasienApi from "../../lib/pasienApi";
import { fmtDate } from "../../lib/utils-id";

const card = "bg-white rounded-3xl border border-slate-200/80 p-5";

export default function Riwayat() {
  const [pantau, setPantau] = useState([]);
  const [mingguan, setMingguan] = useState([]);
  const [ttd, setTtd] = useState([]);
  const [gerakan, setGerakan] = useState([]);

  useEffect(() => {
    pasienApi.get("/pasien/pemantauan?limit=14").then((r) => setPantau(r.data)).catch(() => {});
    pasienApi.get("/pasien/mingguan").then((r) => setMingguan(r.data)).catch(() => {});
    pasienApi.get("/pasien/ttd").then((r) => setTtd(r.data)).catch(() => {});
    pasienApi.get("/pasien/gerakan").then((r) => setGerakan(r.data)).catch(() => {});
  }, []);

  const gerakanChart = [...gerakan].reverse().slice(-14).map((r) => ({ tanggal: r.tanggal.slice(5), jumlah: r.jumlah }));

  return (
    <div className="space-y-4" data-testid="riwayat-page">
      <h1 className="text-xl font-extrabold text-slate-900">Riwayat Saya</h1>

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-900 mb-3">Pemantauan Harian Terakhir</h2>
        {pantau.length === 0 ? <p className="text-xs text-slate-400">Belum ada.</p> : (
          <div className="space-y-2">
            {pantau.slice(0, 7).map((r) => (
              <div key={r.tanggal} className="flex items-center gap-3 text-xs">
                <span className="font-bold text-slate-700 w-20">{fmtDate(r.tanggal)}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${r.tanda_bahaya?.length ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {r.tanda_bahaya?.length ? "Ada keluhan penting" : r.kondisi}
                </span>
                <span className="text-slate-400">{r.emosional}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-900 mb-3">Pemantauan Mingguan</h2>
        {mingguan.length === 0 ? <p className="text-xs text-slate-400">Belum ada.</p> : (
          <div className="space-y-2">
            {mingguan.slice(0, 7).map((r) => (
              <div key={r.minggu_ke} className="flex items-center gap-3 text-xs">
                <span className="font-bold text-slate-700 w-20">Mgg {r.minggu_ke}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${r.ada_bahaya ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {r.ada_bahaya ? "Ada tanda bahaya" : "Semua baik"}
                </span>
                <span className="text-slate-400">{fmtDate(r.tanggal)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-900 mb-3">TTD/MMS Terakhir</h2>
        {ttd.length === 0 ? <p className="text-xs text-slate-400">Belum ada.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {ttd.slice(0, 21).map((r) => (
              <span key={r.tanggal} title={r.tanggal} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                r.status === "sudah" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
              }`}>
                {r.status === "sudah" ? "✓" : "×"}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        <h2 className="text-sm font-bold text-slate-900 mb-3">Gerakan Bayi</h2>
        {gerakanChart.length === 0 ? <p className="text-xs text-slate-400">Belum ada.</p> : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={gerakanChart}>
              <XAxis dataKey="tanggal" fontSize={9} tickLine={false} />
              <YAxis fontSize={9} tickLine={false} axisLine={false} width={24} />
              <Tooltip />
              <Bar dataKey="jumlah" fill="#C02650" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
