import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate } from "../lib/utils-id";

const cardCls = "bg-white rounded-xl border border-slate-200/80 p-5";

export default function PatientCharts({ checkups }) {
  const chartData = checkups.map((c) => ({ ...c, label: fmtDate(c.tanggal) }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className={cardCls}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Grafik Tekanan Darah</h3>
        {chartData.filter((c) => c.sistolik).length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-slate-400" data-testid="bp-chart-empty">Belum ada data tekanan darah</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={10} tickLine={false} />
              <YAxis fontSize={10} domain={[40, 180]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="sistolik" name="Sistolik" stroke="#C02650" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="diastolik" name="Diastolik" stroke="#0F172A" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className={cardCls}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Grafik Berat Badan</h3>
        {chartData.filter((c) => c.berat_badan).length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-slate-400" data-testid="weight-chart-empty">Belum ada data berat badan</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={10} tickLine={false} />
              <YAxis fontSize={10} domain={["auto", "auto"]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="berat_badan" name="Berat Badan (kg)" stroke="#C02650" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
