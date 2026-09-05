import React, { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { Spinner } from './components/common/Spinner';
import { authApi } from './services/api';
import { User } from './types';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await authApi.getMe();
        if (res.success && res.user) {
          setUser(res.user);
        }
      } catch {
        setUser(null);
      } finally {
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs text-slate-400 font-mono animate-pulse">Initializing MailPulse Platform...</p>
      </div>
    );
  }

  return (
    <>
      {user ? (
        <DashboardPage user={user} onLogout={() => setUser(null)} />
      ) : (
        <LoginPage onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />
      )}
    </>
  );
};

export default App;
