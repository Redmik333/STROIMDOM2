import { useAuth } from '@/lib/AuthContext';
import OwnerHome from './OwnerHome';
import ForemanHome from './ForemanHome';

export default function Home() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  return user.role === 'admin' ? <OwnerHome /> : <ForemanHome />;
}