import { format } from "date-fns";
import { id } from "date-fns/locale";

export const fmtDate = (d) => {
  if (!d) return "-";
  return format(new Date(d + "T00:00:00"), "d MMM yyyy", { locale: id });
};

export const usiaLabel = (p) => {
  if (p.fase === "nifas") return `Nifas hari ke-${p.hari_nifas ?? 0}`;
  if (p.usia_minggu == null) return "-";
  return `${p.usia_minggu} mgg ${p.usia_hari} hr`;
};

export const sanitizePhone = (raw) => {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
};

export const waUrl = (phone, message) =>
  `https://wa.me/${sanitizePhone(phone)}?text=${encodeURIComponent(message)}`;
