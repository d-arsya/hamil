import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import PasienLogin from "./pages/pasien/PasienLogin";

const Layout = lazy(() => import("./components/Layout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientDetail = lazy(() => import("./pages/PatientDetail"));
const Edukasi = lazy(() => import("./pages/Edukasi"));
const Laporan = lazy(() => import("./pages/Laporan"));
const FollowUp = lazy(() => import("./pages/FollowUp"));
const Profil = lazy(() => import("./pages/Profil"));
const PasienLayout = lazy(() => import("./pages/pasien/PasienLayout"));
const Beranda = lazy(() => import("./pages/pasien/Beranda"));
const Janji = lazy(() => import("./pages/pasien/Janji"));
const Pemantauan = lazy(() => import("./pages/pasien/Pemantauan"));
const Mingguan = lazy(() => import("./pages/pasien/Mingguan"));
const TTD = lazy(() => import("./pages/pasien/TTD"));
const Gerakan = lazy(() => import("./pages/pasien/Gerakan"));
const TandaBahaya = lazy(() => import("./pages/pasien/TandaBahaya"));
const Persiapan = lazy(() => import("./pages/pasien/Persiapan"));
const EdukasiPasien = lazy(() => import("./pages/pasien/EdukasiPasien"));
const Perjalanan = lazy(() => import("./pages/pasien/Perjalanan"));
const Riwayat = lazy(() => import("./pages/pasien/Riwayat"));
const Pengaturan = lazy(() => import("./pages/pasien/Pengaturan"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]" data-testid="page-loader">
    <div className="text-sm text-slate-400 animate-pulse">Memuat...</div>
  </div>
);

function PasienProtected() {
  if (!localStorage.getItem("pasien_token")) return <Navigate to="/ibu/login" replace />;
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
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/ibu/login" element={<PasienLogin />} />
          <Route element={<PasienProtected />}>
            <Route path="/ibu" element={<Beranda />} />
            <Route path="/ibu/janji" element={<Janji />} />
            <Route path="/ibu/pantau" element={<Pemantauan />} />
            <Route path="/ibu/mingguan" element={<Mingguan />} />
            <Route path="/ibu/ttd" element={<TTD />} />
            <Route path="/ibu/gerakan" element={<Gerakan />} />
            <Route path="/ibu/bahaya" element={<TandaBahaya />} />
            <Route path="/ibu/persiapan" element={<Persiapan />} />
            <Route path="/ibu/edukasi" element={<EdukasiPasien />} />
            <Route path="/ibu/perjalanan" element={<Perjalanan />} />
            <Route path="/ibu/riwayat" element={<Riwayat />} />
            <Route path="/ibu/pengaturan" element={<Pengaturan />} />
          </Route>
          <Route element={<Protected />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pasien" element={<Patients />} />
            <Route path="/pasien/:id" element={<PatientDetail />} />
            <Route path="/edukasi" element={<Edukasi />} />
            <Route path="/laporan" element={<Laporan />} />
            <Route path="/followup" element={<FollowUp />} />
            <Route path="/profil" element={<Profil />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
