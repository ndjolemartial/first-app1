import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastContainer } from '../ui/Toast';
import { useAuthStore } from '../../stores/auth.store';

export default function ProtectedLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
      <ToastContainer />
    </div>
  );
}
