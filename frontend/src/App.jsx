import { useEffect, useMemo, useState } from 'react';
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
import { loginUser, signupUser } from './services/api';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import NotFound from './pages/shared/NotFound';
import BookDetailsPage from './pages/shared/BookDetails';

import StudentDashboard from './pages/student/Dashboard';
import BrowseBooks from './pages/student/BrowseBooks';
import BorrowedBooks from './pages/student/BorrowedBooks';
import HistoryPage from './pages/student/History';
import WishlistPage from './pages/student/Wishlist';
import StudentAIPage from './pages/student/AIChat';

import LibrarianDashboard from './pages/librarian/Dashboard';
import ManageBooks from './pages/librarian/ManageBooks';
import BorrowRecordsPage from './pages/librarian/BorrowRecords';
import StudentsPage from './pages/librarian/Students';
import AnalyticsPage from './pages/librarian/Analytics';
import DatabaseMonitorPage from './pages/librarian/DatabaseMonitor';
import AdminAIPage from './pages/librarian/AIAssistant';

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

function ProtectedLayout({ user, onLogout }) {
  const navItems = user.role === 'librarian' ? librarianNavigation : studentNavigation;

  return (
    <LayoutShell user={user} navItems={navItems} onLogout={onLogout}>
      <Outlet />
    </LayoutShell>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
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
              const signupResponse = await signupUser({
                name: userName,
                email: firebaseUser.email,
                role: 'student',
                firebase_uid: firebaseUser.uid,
              });
              userRole = signupResponse.data.role || 'student';
              userName = signupResponse.data.name || userName;
              userId = signupResponse.data._id || userId;
            } catch (signupError) {
              console.warn("Auto signup failed after missing user:", signupError);
            }
          } else {
            console.warn("Backend login failed, defaulting to student role:", backendError);
          }
        }

        setUser({
          _id: userId,
          name: userName,
          email: firebaseUser.email,
          role: userRole,
          firebase_uid: firebaseUser.uid,
        });
      } catch (requestError) {
        console.error("Auth state error:", requestError);
        await signOut(auth);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    sessionStorage.removeItem("MOCK_ROLE");
    sessionStorage.removeItem("MOCK_NAME");
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
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />

        <Route
          element={
            <RequireAuth user={user}>
              <ProtectedLayout user={user} onLogout={handleLogout} />
            </RequireAuth>
          }
        >
          <Route path="/" element={roleHomeElement} />

          <Route path="/browse-books" element={<BrowseBooks />} />
          <Route path="/borrowed-books" element={<BorrowedBooks />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/ai-librarian" element={<StudentAIPage />} />

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
