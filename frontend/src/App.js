import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Edukasi from "./pages/Edukasi";
import Laporan from "./pages/Laporan";
import PasienLogin from "./pages/pasien/PasienLogin";
import PasienLayout from "./pages/pasien/PasienLayout";
import Beranda from "./pages/pasien/Beranda";
import Pemantauan from "./pages/pasien/Pemantauan";
import Mingguan from "./pages/pasien/Mingguan";
import TTD from "./pages/pasien/TTD";
import Gerakan from "./pages/pasien/Gerakan";
import TandaBahaya from "./pages/pasien/TandaBahaya";
import Persiapan from "./pages/pasien/Persiapan";
import EdukasiPasien from "./pages/pasien/EdukasiPasien";
import Perjalanan from "./pages/pasien/Perjalanan";
import Riwayat from "./pages/pasien/Riwayat";
import Pengaturan from "./pages/pasien/Pengaturan";

function PasienProtected() {
  if (!localStorage.getItem("pasien_token")) return <Navigate to="/pasien/login" replace />;
  return <PasienLayout />;
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading">
        <div className="text-sm text-muted-foreground animate-pulse">Memuat...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pasien/login" element={<PasienLogin />} />
          <Route element={<PasienProtected />}>
            <Route path="/pasien" element={<Beranda />} />
            <Route path="/pasien/pantau" element={<Pemantauan />} />
            <Route path="/pasien/mingguan" element={<Mingguan />} />
            <Route path="/pasien/ttd" element={<TTD />} />
            <Route path="/pasien/gerakan" element={<Gerakan />} />
            <Route path="/pasien/bahaya" element={<TandaBahaya />} />
            <Route path="/pasien/persiapan" element={<Persiapan />} />
            <Route path="/pasien/edukasi" element={<EdukasiPasien />} />
            <Route path="/pasien/perjalanan" element={<Perjalanan />} />
            <Route path="/pasien/riwayat" element={<Riwayat />} />
            <Route path="/pasien/pengaturan" element={<Pengaturan />} />
          </Route>
          <Route element={<Protected />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pasien" element={<Patients />} />
            <Route path="/pasien/:id" element={<PatientDetail />} />
            <Route path="/edukasi" element={<Edukasi />} />
            <Route path="/laporan" element={<Laporan />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
