import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  BookPlus,
  Bot,
  Database,
  History,
  LayoutDashboard,
  Library,
  Sparkles,
  Users,
} from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';

import LayoutShell from './components/LayoutShell';
import LoadingState from './components/LoadingState';
import { auth } from './firebase';
import { clearSessionUser, setSessionUser } from './lib/authSession';
import { loginUser, signupUser } from './services/api';

// Lazy load pages for code splitting
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import NotFound from './pages/shared/NotFound';
const BookDetailsPage = lazy(() => import('./pages/shared/BookDetails'));

// Student pages - lazy loaded
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const BrowseBooks = lazy(() => import('./pages/student/BrowseBooks'));
const BorrowedBooks = lazy(() => import('./pages/student/BorrowedBooks'));
const HistoryPage = lazy(() => import('./pages/student/History'));
const WishlistPage = lazy(() => import('./pages/student/Wishlist'));
const StudentAIPage = lazy(() => import('./pages/student/AIChat'));

// Librarian pages - lazy loaded
const LibrarianDashboard = lazy(() => import('./pages/librarian/Dashboard'));
const ManageBooks = lazy(() => import('./pages/librarian/ManageBooks'));
const BorrowRecordsPage = lazy(() => import('./pages/librarian/BorrowRecords'));
const StudentsPage = lazy(() => import('./pages/librarian/Students'));
const AnalyticsPage = lazy(() => import('./pages/librarian/Analytics'));
const DatabaseMonitorPage = lazy(() => import('./pages/librarian/DatabaseMonitor'));
const AdminAIPage = lazy(() => import('./pages/librarian/AIAssistant'));

const studentNavigation = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/browse-books', label: 'Browse Books', icon: Library },
  { path: '/borrowed-books', label: 'Borrowed Books', icon: BookOpen },
  { path: '/history', label: 'History', icon: History },
  { path: '/wishlist', label: 'Wishlist', icon: Sparkles },
  { path: '/ai-librarian', label: 'AI Librarian', icon: Bot },
];

const librarianNavigation = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/manage-books', label: 'Manage Books', icon: BookPlus },
  { path: '/borrow-records', label: 'Borrow Records', icon: BookOpen },
  { path: '/students', label: 'Students', icon: Users },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/database-monitor', label: 'Database Monitor', icon: Database },
  { path: '/ai-assistant', label: 'AI Assistant', icon: Bot },
];

function RequireAuth({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireLibrarian({ user, children }) {
  if (!user || user.role !== 'librarian') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireStudent({ user, children }) {
  if (!user || user.role !== 'student') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ProtectedLayout({ user, onLogout }) {
  const navItems = user.role === 'librarian' ? librarianNavigation : studentNavigation;

  return (
    <LayoutShell user={user} navItems={navItems} onLogout={onLogout}>
      <Suspense fallback={<LoadingState label="Loading page..." />}>
        <Outlet />
      </Suspense>
    </LayoutShell>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        clearSessionUser();
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        let userRole = 'student';
        let userName = firebaseUser.displayName || 'Student';
        let userId = firebaseUser.uid;

        try {
          const response = await loginUser({
            firebase_uid: firebaseUser.uid,
            email: firebaseUser.email,
          });
          userRole = response.data.role;
          userName = response.data.name || userName;
          userId = response.data._id || userId;
        } catch (backendError) {
          const status = backendError?.response?.status;
          if (status === 404 && firebaseUser.email) {
            try {
              const preferredRole = sessionStorage.getItem("PREFERRED_ROLE");
              const desiredRole = preferredRole === "librarian" ? "librarian" : "student";
              const signupResponse = await signupUser({
                name: userName,
                email: firebaseUser.email,
                role: desiredRole,
                firebase_uid: firebaseUser.uid,
              });
              userRole = signupResponse.data.role || desiredRole;
              userName = signupResponse.data.name || userName;
              userId = signupResponse.data._id || userId;
              sessionStorage.removeItem("PREFERRED_ROLE");
            } catch (signupError) {
              console.warn("Auto signup failed after missing user:", signupError);
            }
          } else {
            console.warn("Backend login failed, defaulting to student role:", backendError);
          }
        }

        const nextUser = {
          _id: userId,
          name: userName,
          email: firebaseUser.email,
          role: userRole,
          firebase_uid: firebaseUser.uid,
        };
        setSessionUser(nextUser);
        setUser(nextUser);
      } catch (requestError) {
        console.error("Auth state error:", requestError);
        await signOut(auth);
        clearSessionUser();
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    clearSessionUser();
    setUser(null);
    sessionStorage.removeItem("MOCK_ROLE");
    sessionStorage.removeItem("MOCK_NAME");
    sessionStorage.removeItem("PREFERRED_ROLE");
  };

  const roleHomeElement = useMemo(() => {
    if (!user) {
      return null;
    }
    return user.role === 'librarian' ? <LibrarianDashboard /> : <StudentDashboard />;
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-gradient">
        <div className="min-h-screen bg-slate-950/75">
          <LoadingState label="Authenticating..." />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Suspense fallback={<LoadingState label="Loading..." />}><Login /></Suspense>} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Suspense fallback={<LoadingState label="Loading..." />}><Signup /></Suspense>} />

        <Route
          element={
            <RequireAuth user={user}>
              <ProtectedLayout user={user} onLogout={handleLogout} />
            </RequireAuth>
          }
        >
          <Route path="/" element={roleHomeElement} />

          <Route path="/browse-books" element={<RequireStudent user={user}><BrowseBooks /></RequireStudent>} />
          <Route path="/borrowed-books" element={<RequireStudent user={user}><BorrowedBooks /></RequireStudent>} />
          <Route path="/history" element={<RequireStudent user={user}><HistoryPage /></RequireStudent>} />
          <Route path="/wishlist" element={<RequireStudent user={user}><WishlistPage /></RequireStudent>} />
          <Route path="/ai-librarian" element={<RequireStudent user={user}><StudentAIPage /></RequireStudent>} />

          <Route path="/manage-books" element={<RequireLibrarian user={user}><ManageBooks /></RequireLibrarian>} />
          <Route path="/borrow-records" element={<RequireLibrarian user={user}><BorrowRecordsPage /></RequireLibrarian>} />
          <Route path="/students" element={<RequireLibrarian user={user}><StudentsPage /></RequireLibrarian>} />
          <Route path="/analytics" element={<RequireLibrarian user={user}><AnalyticsPage /></RequireLibrarian>} />
          <Route path="/database-monitor" element={<RequireLibrarian user={user}><DatabaseMonitorPage /></RequireLibrarian>} />
          <Route path="/ai-assistant" element={<RequireLibrarian user={user}><AdminAIPage /></RequireLibrarian>} />
          <Route path="/books/:bookId" element={<BookDetailsPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
