export const DISCLAIMER =
  "Informasi dalam aplikasi ini ditujukan untuk membantu pemantauan dan edukasi selama kehamilan. Aplikasi tidak menggantikan pemeriksaan dan konsultasi dengan dokter atau bidan.";

export const TANDA_BAHAYA = {
  trimester_1: ["Perdarahan", "Nyeri perut hebat", "Demam tinggi", "Mual muntah hebat", "Sakit saat kencing", "Keputihan/gatal di daerah kemaluan"],
  trimester_2: ["Perdarahan", "Nyeri perut hebat", "Sakit kepala berat", "Pandangan kabur", "Demam tinggi", "Muntah darah", "Sesak/napas pendek", "Jantung berdebar kencang", "Cairan dari jalan lahir sangat banyak/berbau"],
  trimester_3: ["Perdarahan hebat", "Nyeri perut hebat di antara kontraksi", "Sakit kepala berat", "Gerakan bayi tidak ada/kurang dari 10 kali dalam 12 jam", "Ketuban pecah tetapi tidak ada kontraksi"],
  nifas: ["Perdarahan hebat", "Demam tinggi", "Nyeri perut hebat", "Sakit kepala berat", "Keputihan berbau tidak sedap", "Bengkak/nyeri pada payudara disertai demam"],
};

export const MINGGUAN_CHECKLIST = {
  trimester_1: ["Demam tinggi", "Nyeri perut hebat", "Perdarahan", "Mual dan muntah hebat", "Sakit saat kencing", "Keputihan/gatal di daerah kemaluan"],
  trimester_2: ["Pusing/sakit kepala berat", "Pandangan kabur", "Perdarahan", "Nyeri perut hebat", "Demam tinggi", "Muntah darah", "Sesak/napas pendek", "Jantung berdebar kencang", "Cairan dari jalan lahir yang sangat banyak atau berbau", "Sakit saat kencing", "Keputihan/gatal", "Diare berulang"],
  trimester_3: ["Nyeri perut hebat di antara kontraksi", "Perdarahan hebat", "Pusing/sakit kepala berat", "Gerakan bayi tidak ada atau kurang dari 10 kali dalam 12 jam", "Ketuban pecah tetapi tidak ada kontraksi"],
  nifas: ["Perdarahan hebat", "Demam tinggi", "Keputihan berbau tidak sedap", "Sakit kepala berat", "Nyeri perut hebat"],
};

export const PERSIAPAN_ITEMS = [
  "Sudah mengetahui HPL",
  "Sudah menentukan tempat melahirkan",
  "Sudah menentukan pendamping persalinan",
  "Sudah menyiapkan dana persalinan",
  "Sudah memiliki/mengetahui status JKN",
  "Sudah menyiapkan KTP",
  "Sudah menyiapkan Kartu Keluarga",
  "Sudah menyiapkan perlengkapan ibu",
  "Sudah menyiapkan perlengkapan bayi",
  "Sudah menyiapkan calon pendonor darah",
  "Sudah menyiapkan kendaraan",
  "Sudah berdiskusi dengan keluarga mengenai rencana persalinan",
  "Sudah merencanakan KB setelah melahirkan",
];

export const TTD_TIPS = [
  "TTD/MMS dianjurkan diminum setiap hari selama kehamilan.",
  "Jika terasa mual, TTD/MMS dapat diminum pada malam hari sebelum tidur.",
  "Vitamin C membantu penyerapan zat besi.",
  "Hindari minum TTD/MMS bersamaan dengan teh, kopi, susu, dan obat maag karena dapat menghambat penyerapan zat besi.",
];

export const TTD_ALASAN = ["Lupa", "Mual", "Tidak tersedia", "Efek samping", "Alasan lain"];

export const EDUKASI_KATEGORI = [
  { key: "kehamilan", icon: "🩷", label: "Kehamilan" },
  { key: "nutrisi", icon: "🍎", label: "Nutrisi" },
  { key: "ttd", icon: "💊", label: "TTD/MMS" },
  { key: "bayi", icon: "👶", label: "Perkembangan Bayi" },
  { key: "bahaya", icon: "🚨", label: "Tanda Bahaya" },
  { key: "mental", icon: "🧠", label: "Kesehatan Mental" },
  { key: "pemeriksaan", icon: "🏥", label: "Pemeriksaan Kehamilan" },
  { key: "persalinan", icon: "🤰", label: "Persiapan Persalinan" },
  { key: "menyusui", icon: "🍼", label: "Persiapan Menyusui" },
];

export const EDUKASI_ARTIKEL = {
  kehamilan: [
    { judul: "Perubahan Tubuh saat Hamil", isi: "Selama hamil tubuh Ibu berubah: payudara membesar, sering buang air kecil, dan mudah lelah. Ini wajar. Istirahat cukup dan makan bergizi ya, Bu." },
    { judul: "Jangan Lewatkan Pemeriksaan", isi: "Pemeriksaan kehamilan minimal 6 kali membantu memantau kesehatan Ibu dan perkembangan bayi. Datang sesuai jadwal dari bidan." },
  ],
  nutrisi: [
    { judul: "Makan Bergizi Seimbang", isi: "Isi piring Ibu: nasi, lauk (ikan/telur/ayam), sayur hijau, dan buah setiap kali makan. Tambahan satu porsi ekstra untuk si kecil." },
    { judul: "Makanan yang Perlu Dihindari", isi: "Hindari makanan mentah/setengah matang, batasi kopi dan teh, dan jangan minum jamu sembarangan tanpa anjuran nakes." },
  ],
  ttd: [
    { judul: "Jangan Lupa TTD/MMS", isi: "TTD/MMS perlu diminum setiap hari selama kehamilan untuk membantu mencegah kekurangan darah (anemia). Minum bersama makanan/minuman yang mengandung vitamin C agar zat besi terserap baik. Hindari minum bersama teh, kopi, susu, dan obat maag." },
  ],
  bayi: [
    { judul: "Pantau Gerakan Bayi", isi: "Setelah minggu ke-24, perhatikan gerakan bayi setiap hari. Jika gerakan bayi tidak ada atau kurang dari 10 kali dalam 12 jam, segera periksa ke fasilitas kesehatan." },
    { judul: "Perkembangan Bayi per Trimester", isi: "Trimester 1: organ tubuh mulai terbentuk. Trimester 2: bayi mulai bergerak dan tendangannya mulai terasa. Trimester 3: bayi tumbuh cepat dan bersiap lahir." },
  ],
  bahaya: [
    { judul: "Kenali Tanda Bahaya", isi: "Jika mengalami perdarahan, nyeri perut hebat, sakit kepala berat, pandangan kabur, atau gerakan bayi berkurang, segera periksa ke Puskesmas, Rumah Sakit, atau fasilitas pelayanan kesehatan. Jangan menunggu keluhan memburuk." },
  ],
  mental: [
    { judul: "Jaga Kesehatan Mental", isi: "Selama kehamilan, Ibu dapat mengalami perubahan emosi seperti sedih, cemas, stres, atau mudah marah. Jika keluhan terasa berat atau mengganggu aktivitas, bicarakan dengan keluarga dan tenaga kesehatan." },
  ],
  pemeriksaan: [
    { judul: "Apa Saja yang Diperiksa?", isi: "Saat kontrol, bidan memeriksa tekanan darah, berat badan, tinggi rahim, dan detak jantung bayi. Catat keluhan Ibu agar tidak lupa ditanyakan." },
  ],
  persalinan: [
    { judul: "Persiapkan Sejak Dini", isi: "Kenali tanda persalinan: kontraksi teratur, ketuban pecah, atau lendir darah. Siapkan tas perlengkapan, dokumen (KTP, KK, JKN), kendaraan, dan pendamping jauh sebelum HPL." },
  ],
  menyusui: [
    { judul: "Persiapan Menyusui", isi: "ASI adalah makanan terbaik bayi. Sejak hamil, jaga nutrisi dan kesehatan payudara. Setelah lahir, berikan ASI sesegera mungkin (IMD) dalam 1 jam pertama." },
  ],
};

export const BERANDA_EDUKASI_TRIMESTER = {
  trimester_1: "Kenali perubahan tubuh pada awal kehamilan",
  trimester_2: "Mulai persiapkan persalinan sejak dini",
  trimester_3: "Kenali tanda awal persalinan dan tanda bahaya",
  nifas: "Jaga pemulihan Ibu dan perhatikan tumbuh kembang bayi",
};

export const FASE_LABEL = { trimester_1: "Trimester 1", trimester_2: "Trimester 2", trimester_3: "Trimester 3", nifas: "Masa Nifas" };
