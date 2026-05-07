import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { RoomListPage } from './features/room/RoomListPage';
import { RoomPage } from './features/room/RoomPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#2d2d30',
            color: '#d4d4d4',
            border: '1px solid #3c3c3c',
            borderRadius: '10px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1e1e1e' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1e1e1e' },
          },
        }}
      />

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Invite redirect — client-side join via invite URL */}
        <Route
          path="/invite/:code"
          element={
            <ProtectedRoute>
              <InviteRedirect />
            </ProtectedRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RoomListPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/room/:roomId"
          element={
            <ProtectedRoute>
              <RoomPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

/** Handles /invite/:code → joins room and redirects to /room/:roomId */
const InviteRedirect: React.FC = () => {
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const code = window.location.pathname.split('/').pop();
    if (!code) { setError(true); return; }

    import('./features/room/roomService').then(({ roomService }) => {
      roomService.joinByInvite(code)
        .then((room) => {
          window.location.replace(`/room/${room.id}`);
        })
        .catch(() => setError(true));
    });
  }, []);

  if (error) return <Navigate to="/" replace />;

  return (
    <div className="h-screen bg-surface-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[#888] text-sm">Joining room…</p>
      </div>
    </div>
  );
};

export default App;
