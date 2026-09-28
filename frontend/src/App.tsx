import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { DocumentDetails } from './pages/DocumentDetails';
import { Collections } from './pages/Collections';
import { CollectionDetails } from './pages/CollectionDetails';
import { Assistant } from './pages/Assistant';
// import { MissingDocuments } from './pages/MissingDocuments';
// import { Activity } from './pages/Activity';
// import { Settings } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Authentication Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Enterprise Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="documents" element={<Documents />} />
                <Route path="documents/:id" element={<DocumentDetails />} />
                <Route path="collections" element={<Collections />} />
                <Route path="collections/:id" element={<CollectionDetails />} />
                <Route path="assistant" element={<Assistant />} />
                <Route path="chat" element={<Assistant />} />
                {/* <Route path="missing-documents" element={<MissingDocuments />} /> */}
                {/* <Route path="activity" element={<Activity />} /> */}
                {/* <Route path="settings" element={<Settings />} /> */}
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
