import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import AuthForm from './components/AuthForm';
import IOUDashboard from './components/IOUDashboard';
import FriendRequests from './components/FriendRequests';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'ious' | 'friends'>('ious');
  const [needsUsername, setNeedsUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [submittingUsername, setSubmittingUsername] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const hasProfile = await checkUserProfile(session.user.id);
        if (!hasProfile) {
          setNeedsUsername(true);
        } else {
          setNeedsUsername(false);
        }
      }
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        console.log('Auth state changed:', event, session?.user?.email);

        if (session) {
          const hasProfile = await checkUserProfile(session.user.id);
          console.log('Has profile:', hasProfile);

          if (!hasProfile) {
            setNeedsUsername(true);
          } else {
            setNeedsUsername(false);
          }
        } else {
          setNeedsUsername(false);
        }

        setSession(session);
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    return !!data;
  };

  const handleAuthSuccess = () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    setUsernameError('');
    setSubmittingUsername(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .insert([{ id: session.user.id, username: usernameInput }]);

      if (error) {
        if (error.code === '23505') {
          setUsernameError('Username already taken. Please choose another.');
        } else {
          setUsernameError(error.message);
        }
        return;
      }

      setNeedsUsername(false);
      setUsernameInput('');
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to create profile');
    } finally {
      setSubmittingUsername(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  if (needsUsername) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            Choose a Username
          </h2>
          <p className="text-gray-600 mb-6 text-center">
            Please select a username to complete your profile
          </p>
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="johndoe"
              />
              <p className="text-xs text-gray-500 mt-1">
                Letters, numbers, and underscores only
              </p>
            </div>

            {usernameError && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {usernameError}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingUsername}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingUsername ? 'Creating Profile...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex justify-center gap-4">
          <button
            onClick={() => setActiveView('ious')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeView === 'ious'
                ? 'bg-white text-gray-800 shadow-md'
                : 'bg-white/50 text-gray-600 hover:bg-white/70'
            }`}
          >
            IOUs
          </button>
          <button
            onClick={() => setActiveView('friends')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeView === 'friends'
                ? 'bg-white text-gray-800 shadow-md'
                : 'bg-white/50 text-gray-600 hover:bg-white/70'
            }`}
          >
            Friends
          </button>
        </div>

        {activeView === 'ious' ? <IOUDashboard /> : <FriendRequests />}
      </div>
    </div>
  );
}

export default App;
