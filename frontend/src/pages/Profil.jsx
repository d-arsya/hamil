import { useCallback, useEffect, useState } from "react";
import { UserRound, MessageCircle, UserPlus, KeyRound, Users, Save } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const cardCls = "bg-white rounded-xl border border-slate-200/80 p-5";
const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C02650]/30 focus:border-[#C02650] transition-colors";

export default function Profil() {
  const { user } = useAuth();
  const [peng, setPeng] = useState(null);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: "", nama: "", password: "" });
  const [pw, setPw] = useState({ lama: "", baru: "", konfirmasi: "" });
  const [saving, setSaving] = useState("");

  const loadUsers = useCallback(() => api.get("/auth/users").then((r) => setUsers(r.data)).catch(() => {}), []);
  useEffect(() => {
    api.get("/pengaturan").then((r) => setPeng(r.data)).catch(() => {});
    loadUsers();
  }, [loadUsers]);

  const savePengaturan = async () => {
    setSaving("pengaturan");
    try {
      const { data } = await api.put("/pengaturan", peng);
      setPeng(data);
      toast.success("Pengaturan tersimpan — portal pasien otomatis memakai nomor & template ini");
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan pengaturan"));
    } finally {
      setSaving("");
    }
  };

  const tambahUser = async () => {
    if (!newUser.username.trim() || !newUser.nama.trim() || !newUser.password) {
      toast.error("Isi username, nama, dan password");
      return;
    }
    setSaving("user");
    try {
      await api.post("/auth/users", newUser);
      toast.success(`Pengguna ${newUser.username} berhasil ditambahkan`);
      setNewUser({ username: "", nama: "", password: "" });
      loadUsers();
    } catch (err) {
      toast.error(apiError(err, "Gagal menambah pengguna"));
    } finally {
      setSaving("");
    }
  };

  const gantiPassword = async () => {
    if (!pw.lama || !pw.baru) {
      toast.error("Isi password lama dan baru");
      return;
    }
    if (pw.baru !== pw.konfirmasi) {
      toast.error("Konfirmasi password baru tidak sama");
      return;
    }
    setSaving("pw");
    try {
      await api.post("/auth/change-password", { password_lama: pw.lama, password_baru: pw.baru });
      toast.success("Password berhasil diganti");
      setPw({ lama: "", baru: "", konfirmasi: "" });
    } catch (err) {
      toast.error(apiError(err, "Gagal mengganti password"));
    } finally {
      setSaving("");
    }
  };

  return (
    <div data-testid="profil-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-[#C02650] flex items-center justify-center">
          <UserRound className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Profil & Pengaturan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Masuk sebagai <b>{user?.nama || user?.username}</b> (@{user?.username})</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className={cardCls} data-testid="profil-kontak-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#128C4A]" /> Kontak Bidan & Template Pesan
            </h3>
            {!peng ? (
              <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nomor WhatsApp Bidan</label>
                  <input
                    data-testid="profil-wa-input"
                    className={inputCls}
                    placeholder="cth: 081234567890"
                    value={peng.wa_bidan}
                    onChange={(e) => setPeng((s) => ({ ...s, wa_bidan: e.target.value }))}
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">Dipakai tombol "Janji Temu" di portal pasien — pasien langsung chat nomor ini.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Template Pesan Janji Temu (dari pasien)</label>
                  <textarea
                    data-testid="profil-template-janji"
                    rows={4}
                    className={inputCls}
                    value={peng.template_janji}
                    onChange={(e) => setPeng((s) => ({ ...s, template_janji: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Template Follow-Up Mingguan (pengingat kontrol)</label>
                  <textarea
                    data-testid="profil-template-followup"
                    rows={4}
                    className={inputCls}
                    value={peng.template_followup}
                    onChange={(e) => setPeng((s) => ({ ...s, template_followup: e.target.value }))}
                  />
                </div>
                <p className="text-[11px] text-slate-400 -mt-1">Placeholder otomatis: {"{nama}"} {"{kunjungan}"} {"{jadwal}"} {"{bidan}"}</p>
                <button
                  data-testid="profil-save-pengaturan"
                  onClick={savePengaturan}
                  disabled={saving === "pengaturan"}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C02650] text-white hover:bg-[#A01B40] transition-colors disabled:opacity-60"
                >
                  <Save className="w-4 h-4" /> {saving === "pengaturan" ? "Menyimpan..." : "Simpan Pengaturan"}
                </button>
              </div>
            )}
          </div>

          <div className={cardCls} data-testid="profil-password-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#C02650]" /> Ganti Password Saya
            </h3>
            <div className="space-y-3">
              <input data-testid="profil-pw-old" type="password" placeholder="Password lama" className={inputCls} value={pw.lama} onChange={(e) => setPw((f) => ({ ...f, lama: e.target.value }))} autoComplete="current-password" />
              <input data-testid="profil-pw-new" type="password" placeholder="Password baru (min. 8 karakter)" className={inputCls} value={pw.baru} onChange={(e) => setPw((f) => ({ ...f, baru: e.target.value }))} autoComplete="new-password" />
              <input data-testid="profil-pw-confirm" type="password" placeholder="Konfirmasi password baru" className={inputCls} value={pw.konfirmasi} onChange={(e) => setPw((f) => ({ ...f, konfirmasi: e.target.value }))} autoComplete="new-password" />
              <button
                data-testid="profil-pw-submit"
                onClick={gantiPassword}
                disabled={saving === "pw"}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                {saving === "pw" ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </div>
          </div>
        </div>

        <div className={cardCls} data-testid="profil-users-card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C02650]" /> Pengguna Aplikasi
          </h3>
          <div className="space-y-2 mb-5" data-testid="profil-user-list">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100" data-testid={`profil-user-${u.username}`}>
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {(u.nama || u.username)[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{u.nama || "-"}</div>
                  <div className="text-[11px] text-slate-400">@{u.username}</div>
                </div>
                {u.username === user?.username && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-[#FDF2F5] text-[#C02650] border border-rose-100 text-[10px] font-bold">Anda</span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Tambah Pengguna Baru (akses penuh)
            </div>
            <div className="space-y-3">
              <input data-testid="new-user-nama" placeholder="Nama lengkap (cth: Bidan Sari)" className={inputCls} value={newUser.nama} onChange={(e) => setNewUser((f) => ({ ...f, nama: e.target.value }))} />
              <input data-testid="new-user-username" placeholder="Username (huruf kecil/angka, min. 3)" className={inputCls} value={newUser.username} onChange={(e) => setNewUser((f) => ({ ...f, username: e.target.value }))} autoComplete="off" />
              <input data-testid="new-user-password" type="password" placeholder="Password (min. 8 karakter)" className={inputCls} value={newUser.password} onChange={(e) => setNewUser((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" />
              <button
                data-testid="new-user-submit"
                onClick={tambahUser}
                disabled={saving === "user"}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
              >
                {saving === "user" ? "Menyimpan..." : "Tambah Pengguna"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
