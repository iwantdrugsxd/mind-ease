import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FirebaseProvider } from './contexts/FirebaseContext';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Screening from './pages/Screening';
import SelfCare from './pages/SelfCare';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ClinicianLogin from './pages/ClinicianLogin';
import ClinicianRegister from './pages/ClinicianRegister';
import ClinicianDashboard from './pages/ClinicianDashboard';
import ClinicianPatients from './pages/ClinicianPatients';
import ClinicianPatientDetail from './pages/ClinicianPatientDetail';
import ClinicianAlertsPage from './pages/ClinicianAlertsPage';
import ClinicianAppointments from './pages/ClinicianAppointments';
import ClinicianNotes from './pages/ClinicianNotes';
import ClinicianMessages from './pages/ClinicianMessages';
import ClinicianLanding from './pages/ClinicianLanding';
import ClinicianProtectedLayout from './components/clinician/ClinicianProtectedLayout';
import ClinicianConsultations from './pages/ClinicianConsultations';
import ClinicianAssignments from './pages/ClinicianAssignments';
import PatientAppLayout from './components/patient/PatientAppLayout';
import Chatbot from './pages/Chatbot';
import CareTeam from './pages/CareTeam';
import api from './utils/api';
import './App.css';

const SmartHomeRoute: React.FC = () => {
  const { user, loading } = useAuth();
  const [nextRoute, setNextRoute] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    const decide = async () => {
      if (loading) return;
      if (!user) {
        setNextRoute(null);
        return;
      }
      setChecking(true);
      try {
        const res = await api.get<{ next_route?: string }>('/screening/onboarding/state/');
        const route = res.data?.next_route;
        setNextRoute(route === '/register' ? '/register' : '/dashboard');
      } catch {
        // Legacy-safe fallback: if orchestration endpoint fails, keep old home behavior.
        setNextRoute(null);
      } finally {
        setChecking(false);
      }
    };
    decide();
  }, [user, loading]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;
  }
  if (nextRoute) {
    return <Navigate to={nextRoute} replace />;
  }
  return <Home />;
};

function clinicianConsolePath(pathname: string): boolean {
  return (
    pathname.startsWith('/clinician/dashboard') ||
    pathname.startsWith('/clinician/consultations') ||
    pathname.startsWith('/clinician/messages') ||
    pathname.startsWith('/clinician/patients') ||
    pathname.startsWith('/clinician/alerts') ||
    pathname.startsWith('/clinician/assignments') ||
    pathname.startsWith('/clinician/appointments') ||
    pathname.startsWith('/clinician/notes')
  );
}

function patientConsolePath(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/screening') ||
    pathname.startsWith('/selfcare') ||
    pathname.startsWith('/self-care') ||
    pathname.startsWith('/chatbot') ||
    pathname.startsWith('/care-team')
  );
}

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const hidePatientNav = clinicianConsolePath(location.pathname) || patientConsolePath(location.pathname);

  return (
    <div className="App">
      {!hidePatientNav && <Navbar />}
      <main className={hidePatientNav ? 'min-h-screen' : 'min-h-screen bg-gray-50'}>
        <Routes>
          <Route path="/" element={<SmartHomeRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/clinicians" element={<ClinicianLanding />} />
          <Route path="/clinician" element={<Navigate to="/clinician/login" replace />} />
          <Route path="/clinician/login" element={<ClinicianLogin />} />
          <Route path="/clinician/register" element={<ClinicianRegister />} />
          <Route
            path="/clinician/dashboard"
            element={
              <ClinicianProtectedLayout title="Clinician dashboard" subtitle="Assigned patients and priority signals">
                <ClinicianDashboard />
              </ClinicianProtectedLayout>
            }
          />
          <Route
            path="/clinician/patients"
            element={
              <ClinicianProtectedLayout title="Patients" subtitle="Assigned roster">
                <ClinicianPatients />
              </ClinicianProtectedLayout>
            }
          />
          <Route
            path="/clinician/patients/:patientId"
            element={
              <ClinicianProtectedLayout
                title="Care workspace"
                subtitle="Assignment-scoped consultation, messaging, and follow-up"
              >
                <ClinicianPatientDetail />
              </ClinicianProtectedLayout>
            }
          />
          <Route
            path="/clinician/alerts"
            element={
              <ClinicianProtectedLayout title="Alerts" subtitle="Derived from patient summaries">
                <ClinicianAlertsPage />
              </ClinicianProtectedLayout>
            }
          />
          <Route
            path="/clinician/consultations"
            element={
              <ClinicianProtectedLayout title="Consultations" subtitle="Prioritized consultation queue">
                <ClinicianConsultations />
              </ClinicianProtectedLayout>
            }
          />
          <Route
            path="/clinician/messages"
            element={
              <ClinicianProtectedLayout title="Messages" subtitle="Thread-first inbox across assigned consultations">
                <ClinicianMessages />
              </ClinicianProtectedLayout>
            }
          />
          <Route
            path="/clinician/assignments"
            element={
              <ClinicianProtectedLayout title="Assignments" subtitle="Staff-only routing and ownership operations">
                <ClinicianAssignments />
              </ClinicianProtectedLayout>
            }
          />
          <Route
            path="/clinician/appointments"
            element={
              <ClinicianProtectedLayout title="Appointments" subtitle="Your scheduled visits">
                <ClinicianAppointments />
              </ClinicianProtectedLayout>
            }
          />
          <Route
            path="/clinician/notes"
            element={
              <ClinicianProtectedLayout title="Clinical notes" subtitle="Recent documentation">
                <ClinicianNotes />
              </ClinicianProtectedLayout>
            }
          />
          {/* Status route deprecated in simplified flow */}
          <Route
            path="/dashboard"
            element={
              <PatientAppLayout>
                <Dashboard />
              </PatientAppLayout>
            }
          />
          <Route
            path="/screening"
            element={
              <PatientAppLayout>
                <Screening />
              </PatientAppLayout>
            }
          />
          <Route
            path="/selfcare"
            element={
              <PatientAppLayout>
                <SelfCare />
              </PatientAppLayout>
            }
          />
          <Route path="/self-care" element={<Navigate to="/selfcare" replace />} />
          <Route
            path="/chatbot"
            element={
              <PatientAppLayout>
                <Chatbot />
              </PatientAppLayout>
            }
          />
          <Route
            path="/care-team"
            element={
              <PatientAppLayout>
                <CareTeam />
              </PatientAppLayout>
            }
          />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <FirebaseProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </FirebaseProvider>
  );
}

export default App;
