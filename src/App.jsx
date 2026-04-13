import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
// Add page imports here
import Home from './pages/Home';
import SalaryEntry from './pages/SalaryEntry';
import PurchaseEntry from './pages/PurchaseEntry';
import StageEntry from './pages/StageEntry';
import SalesEntry from './pages/SalesEntry';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import HouseHistory from './pages/HouseHistory';
import OwnerHome from './pages/OwnerHome';
import ForemanHome from './pages/ForemanHome';
import Notifications from './pages/Notifications';
import OfflineQueue from './pages/OfflineQueue';
import EventFeed from './pages/EventFeed';
import Finance from './pages/Finance';
import PurchaseRequests from './pages/PurchaseRequests';
import Help from './pages/Help';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/salary" element={<SalaryEntry />} />
      <Route path="/purchase" element={<PurchaseEntry />} />
      <Route path="/stage" element={<StageEntry />} />
      <Route path="/sales" element={<SalesEntry />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/history/:houseName" element={<HouseHistory />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/offline-queue" element={<OfflineQueue />} />
      <Route path="/events" element={<EventFeed />} />
      <Route path="/finance" element={<Finance />} />
      <Route path="/purchase-requests" element={<PurchaseRequests />} />
      <Route path="/help" element={<Help />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App