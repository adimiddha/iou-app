import { useState, useEffect } from 'react';
import { supabase, type Friendship, type Profile } from '../lib/supabase';
import { UserPlus, Check, X, Users } from 'lucide-react';

type FriendshipWithProfile = Friendship & {
  requester_profile?: Profile;
  addressee_profile?: Profile;
};

export default function FriendRequests() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<FriendshipWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendshipWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendshipWithProfile[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadFriendships();

      const channel = supabase
        .channel('friendships-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships' },
          () => {
            loadFriendships();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      setCurrentUser(data);
    }
  };

  const loadFriendships = async () => {
    if (!currentUser) return;

    const { data } = await supabase
      .from('friendships')
      .select(`
        *,
        requester_profile:profiles!friendships_requester_id_fkey(*),
        addressee_profile:profiles!friendships_addressee_id_fkey(*)
      `);

    const friendshipsData = data as FriendshipWithProfile[] || [];

    setFriends(
      friendshipsData.filter(
        f => f.status === 'accepted' &&
        (f.requester_id === currentUser.id || f.addressee_id === currentUser.id)
      )
    );

    setPendingRequests(
      friendshipsData.filter(
        f => f.status === 'pending' && f.addressee_id === currentUser.id
      )
    );

    setSentRequests(
      friendshipsData.filter(
        f => f.status === 'pending' && f.requester_id === currentUser.id
      )
    );
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !searchUsername.trim()) return;

    setLoading(true);
    try {
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', searchUsername.trim())
        .maybeSingle();

      if (!targetUser) {
        showMessage('error', 'User not found');
        setLoading(false);
        return;
      }

      if (targetUser.id === currentUser.id) {
        showMessage('error', 'You cannot add yourself as a friend');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('friendships')
        .insert([{
          requester_id: currentUser.id,
          addressee_id: targetUser.id,
          status: 'pending'
        }]);

      if (error) {
        if (error.code === '23505') {
          showMessage('error', 'Friend request already exists');
        } else {
          showMessage('error', 'Failed to send friend request');
        }
      } else {
        showMessage('success', 'Friend request sent!');
        setSearchUsername('');
      }
    } catch (err) {
      showMessage('error', 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    showMessage('success', 'Friend request accepted!');
  };

  const handleRejectRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    showMessage('success', 'Friend request rejected');
  };

  const handleCancelRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    showMessage('success', 'Friend request cancelled');
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;

    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    showMessage('success', 'Friend removed');
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Add Friend
        </h2>
        <form onSubmit={handleSendRequest} className="flex gap-2">
          <input
            type="text"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            placeholder="Enter username..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </form>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Pending Requests ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg p-4 shadow-sm flex justify-between items-center"
              >
                <span className="font-medium text-gray-700">
                  {request.requester_profile?.username}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptRequest(request.id)}
                    className="bg-green-100 hover:bg-green-200 text-green-600 p-2 rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sentRequests.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Sent Requests ({sentRequests.length})
          </h2>
          <div className="space-y-3">
            {sentRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg p-4 shadow-sm flex justify-between items-center"
              >
                <span className="font-medium text-gray-700">
                  {request.addressee_profile?.username}
                </span>
                <button
                  onClick={() => handleCancelRequest(request.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No friends yet. Send a friend request to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {friends.map((friendship) => {
              const friendProfile =
                friendship.requester_id === currentUser?.id
                  ? friendship.addressee_profile
                  : friendship.requester_profile;

              return (
                <div
                  key={friendship.id}
                  className="bg-white rounded-lg p-4 shadow-sm flex justify-between items-center"
                >
                  <span className="font-medium text-gray-700">
                    {friendProfile?.username}
                  </span>
                  <button
                    onClick={() => handleRemoveFriend(friendship.id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
