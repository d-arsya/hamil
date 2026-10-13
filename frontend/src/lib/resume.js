const esc = (v) =>
  v == null || v === "" ? "-" : String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtTgl = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";

const row = (label, value) =>
  `<tr><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569;font-size:12px;width:42%">${label}</td><td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:12px;font-weight:600">${esc(value)}</td></tr>`;

const section = (title, rowsHtml) =>
  rowsHtml
    ? `<div style="margin-top:14px"><div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#C02650;margin-bottom:6px">${title}</div><table style="width:100%;border-collapse:collapse">${rowsHtml}</table></div>`
    : "";

export function cetakResumeKontrol(c, p, bidanNama = "") {
  const isNifas = c.jenis === "kf";
  const kunjungan = c.ke != null ? `${isNifas ? "KF" : "K"}${c.ke}` : "-";
  const usia = isNifas
    ? p.hari_nifas != null ? `${p.hari_nifas} hari nifas` : "-"
    : p.usia_minggu != null ? `${p.usia_minggu} minggu ${p.usia_hari ?? 0} hari` : "-";

  const ttv = [
    c.sistolik && c.diastolik ? `TD ${c.sistolik}/${c.diastolik} mmHg` : null,
    c.spo2 != null ? `SpO2 ${c.spo2}%` : null,
    c.suhu != null ? `Suhu ${c.suhu}°C` : null,
    c.nadi != null ? `Nadi ${c.nadi} x/mnt` : null,
    c.rr != null ? `RR ${c.rr} x/mnt` : null,
    c.tinggi_badan != null ? `TB ${c.tinggi_badan} cm` : null,
    c.berat_badan != null ? `BB ${c.berat_badan} kg` : null,
    c.tinggi_fundus != null ? `TFU ${c.tinggi_fundus} cm` : null,
  ].filter(Boolean);

  const bayiAnc = !isNifas
    ? [
        c.djj != null ? row("DJJ", `${c.djj} x/mnt`) : "",
        c.tbj != null ? row("Taksiran Berat Janin (TBJ)", `${c.tbj} gram`) : "",
        row("Letak Plasenta", c.letak_plasenta),
        row("Air Ketuban", c.ketuban),
        row("Jumlah Janin", c.jumlah_janin),
        row("Keadaan Janin", c.keadaan_janin),
        row("Lokasi Kehamilan", c.lokasi_kehamilan),
        row("Presentasi", c.presentasi),
        row("Jenis Kelamin Janin", c.jk_janin),
      ].filter((r) => r && !r.endsWith("<td style=\"padding:6px 10px;border:1px solid #cbd5e1;font-size:12px;font-weight:600\">-</td></tr>") ? true : true).join("")
    : "";

  const bayiPnc = isNifas
    ? [
        c.bayi_bb != null ? row("Berat Badan Bayi", `${c.bayi_bb} gram`) : "",
        c.bayi_pb != null ? row("Panjang Badan Bayi", `${c.bayi_pb} cm`) : "",
        c.bayi_lk != null ? row("Lingkar Kepala Bayi", `${c.bayi_lk} cm`) : "",
        c.bayi_suhu != null ? row("Suhu Bayi", `${c.bayi_suhu}°C`) : "",
        row("Tali Pusat", c.bayi_tali_pusat),
        row("Ikterus", c.bayi_ikterus),
      ].join("")
    : "";

  const nifasExtra = isNifas
    ? [
        c.jenis_kb ? row("Jenis KB", `${c.jenis_kb}${c.kontrol_kb ? " (kontrol rutin)" : ""}`) : "",
        c.imunisasi_diberikan ? row("Imunisasi Bayi Diberikan", c.imunisasi_diberikan) : "",
      ].join("")
    : "";

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>Resume Kontrol — ${esc(p.nama)}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:24px auto;color:#0f172a;padding:0 16px">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #C02650;padding-bottom:10px">
    <div>
      <div style="font-size:20px;font-weight:800">BidanKu — Resume Kontrol Pasien</div>
      <div style="font-size:12px;color:#64748b">${isNifas ? "Kunjungan Nifas (PNC)" : "Kunjungan Antenatal (ANC)"} · ${kunjungan}</div>
    </div>
    <div style="font-size:11px;color:#64748b;text-align:right">Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
  </div>

  ${section("Identitas Pasien", [
    row("Nama", p.nama),
    row("No. Rekam Medis", p.no_rm),
    row("No. BPJS", p.no_bpjs),
    row("Usia", p.usia_tahun != null ? `${p.usia_tahun} tahun` : "-"),
    row("HPHT / HPL", `${fmtTgl(p.hpht)} / ${fmtTgl(p.hpl)}`),
    row("G / P / A", `G${p.gravida ?? "-"} P${p.para ?? "-"} A${p.abortus ?? "-"}`),
    row("Penyakit Penyerta", p.penyakit_penyerta),
  ].join(""))}

  ${section(`Data Kunjungan — ${fmtTgl(c.tanggal)}`, [
    row("Jenis / Kunjungan", `${isNifas ? "PNC (Nifas)" : "ANC (Kehamilan)"} · ${kunjungan}`),
    row("Usia Kehamilan / Nifas", usia),
    row("Tanda Vital", ttv.length ? ttv.join(" · ") : "-"),
    row("Keluhan", c.keluhan),
    row("Catatan Bidan", c.catatan),
    row("Rencana Tindak Lanjut", c.rencana_tindak_lanjut),
  ].join(""))}

  ${section("Detail Bayi (ANC)", bayiAnc)}
  ${section("Pemeriksaan Fisik Bayi (PNC)", bayiPnc)}
  ${section("KB & Imunisasi", nifasExtra)}

  <div style="margin-top:28px;display:flex;justify-content:space-between;font-size:12px;color:#475569">
    <div>Dokumen ini dihasilkan otomatis oleh BidanKu.</div>
    <div style="text-align:center">Bidan Pemeriksa,<br><br><br><b>${esc(bidanNama || "-")}</b></div>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  return true;
}
