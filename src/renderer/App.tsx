import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from './shared/stores/auth.store';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
