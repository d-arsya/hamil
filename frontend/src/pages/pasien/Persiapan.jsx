import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import pasienApi from "../../lib/pasienApi";
import { PERSIAPAN_ITEMS } from "../../lib/konten";

export default function Persiapan() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    pasienApi.get("/pasien/persiapan").then((r) => setItems(r.data.items || {}));
  }, []);

  if (!items) return <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>;

  const done = PERSIAPAN_ITEMS.filter((k) => items[k]).length;
  const persen = Math.round((done / PERSIAPAN_ITEMS.length) * 100);

  const toggle = async (k) => {
    const next = { ...items, [k]: !items[k] };
    setItems(next);
    await pasienApi.put("/pasien/persiapan", { items: next });
  };

  return (
    <div className="space-y-4" data-testid="persiapan-page">
      <h1 className="text-xl font-extrabold text-slate-900">Persiapan Persalinan Saya</h1>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-5">
        <div className="flex items-center justify-between text-sm font-bold text-slate-900 mb-2">
          <span>Persiapan persalinan {done}/{PERSIAPAN_ITEMS.length} selesai</span>
          <span className="text-[#C02650]">{persen}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden" data-testid="persiapan-progress">
          <div className="h-full bg-[#C02650] rounded-full transition-all" style={{ width: `${persen}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {PERSIAPAN_ITEMS.map((k, i) => (
          <button
            key={k}
            data-testid={`persiapan-item-${i}`}
            onClick={() => toggle(k)}
            className={`w-full flex items-center gap-3 text-left p-4 rounded-2xl border transition-colors ${
              items[k] ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200/80"
            }`}
          >
            {items[k] ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" /> : <Circle className="w-6 h-6 text-slate-300 shrink-0" />}
            <span className={`text-sm font-semibold ${items[k] ? "text-emerald-800" : "text-slate-700"}`}>{k}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
