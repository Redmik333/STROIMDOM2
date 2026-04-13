import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, WifiOff } from 'lucide-react';

export default function PageLayout({ title, subtitle, children, backTo = '/' }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div className="min-h-screen bg-background font-inter">
      {!isOnline && (
        <div className="bg-yellow-400 text-yellow-900 text-xs font-medium px-4 py-2 flex items-center gap-2">
          <WifiOff className="w-3 h-3" />
          Нет интернета — данные сохраняются локально
        </div>
      )}
      <div className="bg-foreground text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <Link to={backTo} className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Назад
          </Link>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-white/50 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
}