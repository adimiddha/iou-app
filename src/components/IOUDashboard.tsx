import { useState, useEffect } from 'react';
import { supabase, type IOU, type Profile } from '../lib/supabase';
import { Beer, Plus, Minus, LogOut, Users } from 'lucide-react';

type IOUWithProfiles = IOU & {
  from_profile: Profile;
  to_profile: Profile;
};

type IOUSummary = {
  userId: string;
  username: string;
  netAmount: number;
};

export default function IOUDashboard() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [ious, setIous] = useState<IOUWithProfiles[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(1);
  const [direction, setDirection] = useState<'owe' | 'owed'>('owe');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserData();
    loadProfiles();
    loadIOUs();

    const channel = supabase
      .channel('ious-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ious' },
        () => {
          loadIOUs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const loadProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('username');

    setProfiles(data || []);
  };

  const loadIOUs = async () => {
    const { data } = await supabase
      .from('ious')
      .select(`
        *,
        from_profile:profiles!ious_from_user_id_fkey(*),
        to_profile:profiles!ious_to_user_id_fkey(*)
      `)
      .order('created_at', { ascending: false });

    setIous(data as IOUWithProfiles[] || []);
  };

  const handleAddIOU = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedUser || !description) return;

    setLoading(true);
    try {
      const iouData = {
        from_user_id: direction === 'owe' ? currentUser.id : selectedUser,
        to_user_id: direction === 'owe' ? selectedUser : currentUser.id,
        description,
        amount,
      };

      await supabase.from('ious').insert([iouData]);

      setSelectedUser('');
      setDescription('');
      setAmount(1);
    } catch (err) {
      console.error('Error adding IOU:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAmount = async (iouId: string, newAmount: number) => {
    if (newAmount <= 0) {
      await supabase.from('ious').delete().eq('id', iouId);
    } else {
      await supabase
        .from('ious')
        .update({ amount: newAmount })
        .eq('id', iouId);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const calculateSummary = (): IOUSummary[] => {
    if (!currentUser) return [];

    const summaryMap = new Map<string, IOUSummary>();

    ious.forEach((iou) => {
      if (iou.from_user_id === currentUser.id) {
        const existing = summaryMap.get(iou.to_user_id) || {
          userId: iou.to_user_id,
          username: iou.to_profile.username,
          netAmount: 0,
        };
        existing.netAmount -= iou.amount;
        summaryMap.set(iou.to_user_id, existing);
      } else if (iou.to_user_id === currentUser.id) {
        const existing = summaryMap.get(iou.from_user_id) || {
          userId: iou.from_user_id,
          username: iou.from_profile.username,
          netAmount: 0,
        };
        existing.netAmount += iou.amount;
        summaryMap.set(iou.from_user_id, existing);
      }
    });

    return Array.from(summaryMap.values()).filter((s) => s.netAmount !== 0);
  };

  const summary = calculateSummary();
  const otherProfiles = profiles.filter((p) => p.id !== currentUser?.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Beer className="w-8 h-8 text-white" />
                <div>
                  <h1 className="text-3xl font-bold text-white">IOU</h1>
                  <p className="text-amber-100 text-sm">Track favors with friends</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white font-medium">
                  {currentUser?.username}
                </span>
                <button
                  onClick={handleSignOut}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Summary
                </h2>
                {summary.length === 0 ? (
                  <p className="text-gray-500 text-sm">No IOUs yet</p>
                ) : (
                  <div className="space-y-3">
                    {summary.map((s) => (
                      <div
                        key={s.userId}
                        className="flex justify-between items-center bg-white rounded-lg p-3 shadow-sm"
                      >
                        <span className="font-medium text-gray-700">{s.username}</span>
                        <span
                          className={`font-bold text-lg ${
                            s.netAmount > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {s.netAmount > 0 ? '+' : ''}
                          {s.netAmount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Add IOU</h2>
                <form onSubmit={handleAddIOU} className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection('owe')}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        direction === 'owe'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      I Owe
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('owed')}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        direction === 'owed'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      Owes Me
                    </button>
                  </div>

                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select friend...</option>
                    {otherProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.username}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="What? (e.g., beer, ride, lunch)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                    min="1"
                    required
                    placeholder="Amount"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add IOU'}
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">All IOUs</h2>
              {ious.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No IOUs recorded yet. Add one above to get started!
                </p>
              ) : (
                <div className="space-y-3">
                  {ious.map((iou) => {
                    const isOwing = iou.from_user_id === currentUser?.id;
                    return (
                      <div
                        key={iou.id}
                        className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${
                          isOwing ? 'border-red-400' : 'border-green-400'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">
                              {isOwing ? (
                                <>
                                  You owe{' '}
                                  <span className="text-blue-600">
                                    {iou.to_profile.username}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-blue-600">
                                    {iou.from_profile.username}
                                  </span>{' '}
                                  owes you
                                </>
                              )}
                            </p>
                            <p className="text-sm text-gray-600">
                              {iou.amount} × {iou.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleUpdateAmount(iou.id, iou.amount - 1)
                              }
                              className="bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-lg transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-bold text-lg text-gray-800 w-8 text-center">
                              {iou.amount}
                            </span>
                            <button
                              onClick={() =>
                                handleUpdateAmount(iou.id, iou.amount + 1)
                              }
                              className="bg-green-100 hover:bg-green-200 text-green-600 p-2 rounded-lg transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
