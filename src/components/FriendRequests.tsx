import { useState, useEffect } from 'react';
import { supabase, type Friendship, type Profile } from '../lib/supabase';
import { hashPhoneNumber, validatePhoneNumber } from '../lib/phone-utils';
import PhoneInput from './PhoneInput';
import { UserPlus, Check, X, Users, MoreVertical, Phone } from 'lucide-react';

type FriendshipWithProfile = Friendship & {
  requester_profile?: Profile;
  addressee_profile?: Profile;
};

export default function FriendRequests() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<FriendshipWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendshipWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendshipWithProfile[]>([]);
  const [searchMode, setSearchMode] = useState<'username' | 'phone'>('username');
  const [searchUsername, setSearchUsername] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [phoneSearchResult, setPhoneSearchResult] = useState<{ id: string; username: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const createNotification = async (
    userId: string,
    type: string,
    title: string,
    message: string,
    relatedUserId?: string
  ) => {
    await supabase.from('notifications').insert([{
      user_id: userId,
      type,
      title,
      message,
      related_user_id: relatedUserId
    }]);
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

  const sendRequestToUserId = async (targetUserId: string): Promise<boolean> => {
    if (!currentUser || targetUserId === currentUser.id) return false;
    const { data: existingFriendship } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUser.id})`)
      .maybeSingle();
    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        showMessage('error', 'You are already friends with this user');
      } else if (existingFriendship.status === 'pending') {
        if (existingFriendship.requester_id === currentUser.id) {
          showMessage('error', 'Friend request already sent');
        } else {
          showMessage('error', 'This user has already sent you a friend request. Check your pending requests!');
        }
      }
      return false;
    }
    const { error } = await supabase
      .from('friendships')
      .insert([{
        requester_id: currentUser.id,
        addressee_id: targetUserId,
        status: 'pending'
      }]);
    if (error) {
      if (error.code === '23505') {
        showMessage('error', 'Friend request already exists');
      } else {
        showMessage('error', 'Failed to send friend request');
      }
      return false;
    }
    await createNotification(
      targetUserId,
      'friend_request',
      'New Friend Request',
      `${currentUser.username} sent you a friend request`,
      currentUser.id
    );
    await loadFriendships();
    showMessage('success', 'Friend request sent!');
    return true;
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !searchUsername.trim()) return;
    setLoading(true);
    try {
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', searchUsername.trim())
        .maybeSingle();
      if (!targetUser) {
        showMessage('error', 'User not found');
        setLoading(false);
        return;
      }
      const ok = await sendRequestToUserId(targetUser.id);
      if (ok) setSearchUsername('');
    } catch (err) {
      showMessage('error', 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchPhone.length !== 10) return;
    if (!validatePhoneNumber(searchPhone)) {
      showMessage('error', 'Enter a valid 10-digit number.');
      return;
    }
    setLoading(true);
    setPhoneSearchResult(null);
    try {
      const hash = await hashPhoneNumber(searchPhone);
      const { data, error } = await supabase.rpc('search_by_phone_hash', { phone_hash_input: hash });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.id && row?.username) {
        setPhoneSearchResult({ id: row.id, username: row.username });
      } else {
        showMessage('error', 'No user found with that number.');
      }
    } catch (err) {
      showMessage('error', 'Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequestByPhone = async () => {
    if (!currentUser || !phoneSearchResult) return;
    setLoading(true);
    try {
      const ok = await sendRequestToUserId(phoneSearchResult.id);
      if (ok) {
        setPhoneSearchResult(null);
        setSearchPhone('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    await loadFriendships();
    showMessage('success', 'Friend request accepted!');
  };

  const handleRejectRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    await loadFriendships();
    showMessage('success', 'Friend request rejected');
  };

  const handleCancelRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    await loadFriendships();
    showMessage('success', 'Friend request cancelled');
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;

    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    await loadFriendships();
    setOpenMenuId(null);
    showMessage('success', 'Friend removed');
  };

  const toggleMenu = (friendshipId: string) => {
    setOpenMenuId(openMenuId === friendshipId ? null : friendshipId);
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
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setSearchMode('username'); setPhoneSearchResult(null); }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              searchMode === 'username'
                ? 'bg-purple-600 text-white'
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            By username
          </button>
          <button
            type="button"
            onClick={() => { setSearchMode('phone'); setPhoneSearchResult(null); }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
              searchMode === 'phone'
                ? 'bg-purple-600 text-white'
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            <Phone className="w-4 h-4" />
            By phone number
          </button>
        </div>

        {searchMode === 'username' && (
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
        )}

        {searchMode === 'phone' && (
          <>
            <p className="text-sm text-gray-600 mb-3">
              We never upload or store your contacts. Add your number in Profile so friends can find you.
            </p>
            <form onSubmit={handlePhoneSearch} className="flex gap-2">
              <PhoneInput
                value={searchPhone}
                onChange={setSearchPhone}
                placeholder="(xxx) xxx-xxxx"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>
            {phoneSearchResult && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200 flex justify-between items-center">
                <span className="font-medium text-gray-800">{phoneSearchResult.username}</span>
                <button
                  type="button"
                  onClick={handleSendRequestByPhone}
                  disabled={loading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            )}
          </>
        )}
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
                  className="bg-white rounded-lg p-4 shadow-sm flex justify-between items-center relative"
                >
                  <span className="font-medium text-gray-700">
                    {friendProfile?.username}
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => toggleMenu(friendship.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                    {openMenuId === friendship.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={() => handleRemoveFriend(friendship.id)}
                          className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                        >
                          Remove Friend
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
