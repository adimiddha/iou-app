import { useState, useEffect } from 'react';
import { supabase, type IOU, type Profile, type IOUType, type IOUStatus, type Friendship } from '../lib/supabase';
import { Beer, Plus, Minus, LogOut, Users, Check, Clock, AlertCircle, X } from 'lucide-react';

type IOUWithProfiles = IOU & {
  from_profile: Profile;
  to_profile: Profile;
};

type IOUSummary = {
  userId: string;
  username: string;
  balances: Record<IOUType, number>;
  overallStatus: 'confirmed' | 'pending' | 'disputed';
};

const IOU_TYPES: IOUType[] = ['Coffee', 'Beer', 'Meal', 'Walk', 'Ride', 'Pizza'];

const IOU_EMOJIS: Record<IOUType, string> = {
  Coffee: '☕',
  Beer: '🍺',
  Meal: '🍽️',
  Walk: '🚶',
  Ride: '🚗',
  Pizza: '🍕'
};

export default function IOUDashboard() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [ious, setIous] = useState<IOUWithProfiles[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [description, setDescription] = useState<IOUType>('Coffee');
  const [amount, setAmount] = useState(1);
  const [direction, setDirection] = useState<'owe' | 'owed'>('owe');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('all');
  const [generousDecreaseModal, setGenerousDecreaseModal] = useState<{ friendId: string; type: IOUType; maxAmount: number } | null>(null);
  const [generousDecreaseAmount, setGenerousDecreaseAmount] = useState(1);
  const [generousDecreaseNote, setGenerousDecreaseNote] = useState('');

  const [selfishIncreaseModal, setSelfishIncreaseModal] = useState<{ friendId: string; type: IOUType } | null>(null);
  const [selfishIncreaseNote, setSelfishIncreaseNote] = useState('');

  const [generousIncreaseModal, setGenerousIncreaseModal] = useState<{ friendId: string; type: IOUType } | null>(null);
  const [generousIncreaseNote, setGenerousIncreaseNote] = useState('');

  const [settleUpModal, setSettleUpModal] = useState<{ friendId: string; type: IOUType; maxAmount: number } | null>(null);
  const [settleUpAmount, setSettleUpAmount] = useState(1);
  const [settleUpNote, setSettleUpNote] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadFriends();
      loadIOUs();

      const iousChannel = supabase
        .channel('ious-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ious' },
          () => {
            loadIOUs();
          }
        )
        .subscribe();

      const friendshipsChannel = supabase
        .channel('friendships-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships' },
          () => {
            loadFriends();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(iousChannel);
        supabase.removeChannel(friendshipsChannel);
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

  const loadFriends = async () => {
    if (!currentUser) return;

    const { data } = await supabase
      .from('friendships')
      .select(`
        *,
        requester_profile:profiles!friendships_requester_id_fkey(*),
        addressee_profile:profiles!friendships_addressee_id_fkey(*)
      `)
      .eq('status', 'accepted');

    const friendshipsData = data as (Friendship & {
      requester_profile: Profile;
      addressee_profile: Profile;
    })[] || [];

    const friendProfiles = friendshipsData.map(f =>
      f.requester_id === currentUser.id ? f.addressee_profile : f.requester_profile
    );

    setFriends(friendProfiles);
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
        status: direction === 'owe' ? 'confirmed' as IOUStatus : 'pending' as IOUStatus,
        requester_user_id: currentUser.id
      };

      const { error } = await supabase.from('ious').insert([iouData]);

      if (error) {
        console.error('Error adding IOU:', error);
        alert('Failed to add IOU. Make sure you are friends with this user.');
      } else {
        await loadIOUs();
        setSelectedUser('');
        setDescription('Coffee');
        setAmount(1);
      }
    } catch (err) {
      console.error('Error adding IOU:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleSummaryAdjust = async (friendId: string, iouType: IOUType, delta: number) => {
    if (!currentUser) return;

    const relevantIOUs = ious.filter(
      (iou) =>
        iou.description === iouType &&
        ((iou.from_user_id === currentUser.id && iou.to_user_id === friendId) ||
          (iou.from_user_id === friendId && iou.to_user_id === currentUser.id))
    );

    const currentBalance = relevantIOUs.reduce((sum, iou) => {
      if (iou.from_user_id === currentUser.id) {
        return sum - iou.amount;
      } else {
        return sum + iou.amount;
      }
    }, 0);

    const newBalance = currentBalance + delta;

    await supabase.from('ious').delete().or(
      `and(from_user_id.eq.${currentUser.id},to_user_id.eq.${friendId},description.eq.${iouType}),and(from_user_id.eq.${friendId},to_user_id.eq.${currentUser.id},description.eq.${iouType})`
    );

    if (newBalance > 0) {
      await supabase.from('ious').insert([{
        from_user_id: friendId,
        to_user_id: currentUser.id,
        description: iouType,
        amount: newBalance
      }]);
    } else if (newBalance < 0) {
      await supabase.from('ious').insert([{
        from_user_id: currentUser.id,
        to_user_id: friendId,
        description: iouType,
        amount: Math.abs(newBalance)
      }]);
    }

    await loadIOUs();
  };

  const handleGenerousDecrease = async () => {
    if (!currentUser || !generousDecreaseModal) return;

    const { friendId, type } = generousDecreaseModal;

    try {
      const confirmedIOUs = ious.filter(
        (iou) =>
          iou.status === 'confirmed' &&
          iou.description === type &&
          ((iou.from_user_id === currentUser.id && iou.to_user_id === friendId) ||
            (iou.from_user_id === friendId && iou.to_user_id === currentUser.id))
      );

      const currentBalance = confirmedIOUs.reduce((sum, iou) => {
        if (iou.from_user_id === currentUser.id) {
          return sum - iou.amount;
        } else {
          return sum + iou.amount;
        }
      }, 0);

      if (currentBalance <= 0) {
        alert('Balance has changed. They no longer owe you anything.');
        setGenerousDecreaseModal(null);
        await loadIOUs();
        return;
      }

      const actualDecreaseAmount = Math.min(generousDecreaseAmount, currentBalance);
      const newBalance = currentBalance - actualDecreaseAmount;

      const { error: deleteError } = await supabase.from('ious').delete().or(
        `and(from_user_id.eq.${currentUser.id},to_user_id.eq.${friendId},description.eq.${type},status.eq.confirmed),and(from_user_id.eq.${friendId},to_user_id.eq.${currentUser.id},description.eq.${type},status.eq.confirmed)`
      );

      if (deleteError) throw deleteError;

      if (newBalance > 0) {
        const { error: insertError } = await supabase.from('ious').insert([{
          from_user_id: friendId,
          to_user_id: currentUser.id,
          description: type,
          amount: newBalance,
          status: 'confirmed'
        }]);

        if (insertError) throw insertError;
      }

      await loadIOUs();
      setGenerousDecreaseModal(null);
      setGenerousDecreaseAmount(1);
      setGenerousDecreaseNote('');
    } catch (error) {
      console.error('Error forgiving debt:', error);
      alert('Failed to forgive debt. Please try again.');
      await loadIOUs();
    }
  };

  const handleSelfishIncrease = async () => {
    if (!currentUser || !selfishIncreaseModal) return;

    const { friendId, type } = selfishIncreaseModal;

    try {
      const iouData = {
        from_user_id: friendId,
        to_user_id: currentUser.id,
        description: type,
        amount: 1,
        status: 'pending' as IOUStatus,
        optional_note: selfishIncreaseNote || null,
        requester_user_id: currentUser.id
      };

      const { error } = await supabase.from('ious').insert([iouData]);

      if (error) throw error;

      await loadIOUs();
      setSelfishIncreaseModal(null);
      setSelfishIncreaseNote('');
    } catch (error) {
      console.error('Error creating pending increase:', error);
      alert('Failed to send request. Please try again.');
    }
  };

  const handleGenerousIncrease = async () => {
    if (!currentUser || !generousIncreaseModal) return;

    const { friendId, type } = generousIncreaseModal;

    try {
      const confirmedIOUs = ious.filter(
        (iou) =>
          iou.status === 'confirmed' &&
          iou.description === type &&
          ((iou.from_user_id === currentUser.id && iou.to_user_id === friendId) ||
            (iou.from_user_id === friendId && iou.to_user_id === currentUser.id))
      );

      const currentBalance = confirmedIOUs.reduce((sum, iou) => {
        if (iou.from_user_id === currentUser.id) {
          return sum - iou.amount;
        } else {
          return sum + iou.amount;
        }
      }, 0);

      const newBalance = currentBalance - 1;

      const { error: deleteError } = await supabase.from('ious').delete().or(
        `and(from_user_id.eq.${currentUser.id},to_user_id.eq.${friendId},description.eq.${type},status.eq.confirmed),and(from_user_id.eq.${friendId},to_user_id.eq.${currentUser.id},description.eq.${type},status.eq.confirmed)`
      );

      if (deleteError) throw deleteError;

      if (newBalance > 0) {
        const { error: insertError } = await supabase.from('ious').insert([{
          from_user_id: friendId,
          to_user_id: currentUser.id,
          description: type,
          amount: newBalance,
          status: 'confirmed'
        }]);

        if (insertError) throw insertError;
      } else if (newBalance < 0) {
        const { error: insertError } = await supabase.from('ious').insert([{
          from_user_id: currentUser.id,
          to_user_id: friendId,
          description: type,
          amount: Math.abs(newBalance),
          status: 'confirmed'
        }]);

        if (insertError) throw insertError;
      }

      await loadIOUs();
      setGenerousIncreaseModal(null);
      setGenerousIncreaseNote('');
    } catch (error) {
      console.error('Error adding to your IOU:', error);
      alert('Failed to add to your IOU. Please try again.');
      await loadIOUs();
    }
  };

  const handleSettleUp = async () => {
    if (!currentUser || !settleUpModal) return;

    const { friendId, type, maxAmount } = settleUpModal;

    try {
      const confirmedIOUs = ious.filter(
        (iou) =>
          iou.status === 'confirmed' &&
          iou.description === type &&
          ((iou.from_user_id === currentUser.id && iou.to_user_id === friendId) ||
            (iou.from_user_id === friendId && iou.to_user_id === currentUser.id))
      );

      const currentBalance = confirmedIOUs.reduce((sum, iou) => {
        if (iou.from_user_id === currentUser.id) {
          return sum - iou.amount;
        } else {
          return sum + iou.amount;
        }
      }, 0);

      if (currentBalance >= 0) {
        alert('Balance has changed. You no longer owe them anything.');
        setSettleUpModal(null);
        await loadIOUs();
        return;
      }

      const actualSettleAmount = Math.min(settleUpAmount, Math.abs(currentBalance));

      const iouData = {
        from_user_id: currentUser.id,
        to_user_id: friendId,
        description: type,
        amount: actualSettleAmount,
        status: 'pending_decrease' as IOUStatus,
        optional_note: settleUpNote || null,
        requester_user_id: currentUser.id
      };

      const { error } = await supabase.from('ious').insert([iouData]);

      if (error) throw error;

      await loadIOUs();
      setSettleUpModal(null);
      setSettleUpAmount(1);
      setSettleUpNote('');
    } catch (error) {
      console.error('Error creating settle up request:', error);
      alert('Failed to send settle up request. Please try again.');
    }
  };

  const handleApprovePending = async (iouId: string) => {
    if (!currentUser) return;

    const pendingIOU = ious.find(iou => iou.id === iouId);
    if (!pendingIOU) return;

    const friendId = pendingIOU.from_user_id === currentUser.id
      ? pendingIOU.to_user_id
      : pendingIOU.from_user_id;
    const iouType = pendingIOU.description;
    const decreaseAmount = pendingIOU.amount;
    const payerId = pendingIOU.from_user_id;

    const confirmedIOUs = ious.filter(
      (iou) =>
        iou.status === 'confirmed' &&
        iou.description === iouType &&
        ((iou.from_user_id === currentUser.id && iou.to_user_id === friendId) ||
          (iou.from_user_id === friendId && iou.to_user_id === currentUser.id))
    );

    const currentBalance = confirmedIOUs.reduce((sum, iou) => {
      if (iou.from_user_id === currentUser.id) {
        return sum - iou.amount;
      } else {
        return sum + iou.amount;
      }
    }, 0);

    let newBalance;
    if (payerId === currentUser.id) {
      newBalance = currentBalance + decreaseAmount;
    } else {
      newBalance = currentBalance - decreaseAmount;
    }

    await supabase.from('ious').delete().or(
      `and(from_user_id.eq.${currentUser.id},to_user_id.eq.${friendId},description.eq.${iouType},status.eq.confirmed),and(from_user_id.eq.${friendId},to_user_id.eq.${currentUser.id},description.eq.${iouType},status.eq.confirmed)`
    );

    await supabase.from('ious').delete().eq('id', iouId);

    if (newBalance > 0) {
      await supabase.from('ious').insert([{
        from_user_id: friendId,
        to_user_id: currentUser.id,
        description: iouType,
        amount: newBalance,
        status: 'confirmed'
      }]);
    } else if (newBalance < 0) {
      await supabase.from('ious').insert([{
        from_user_id: currentUser.id,
        to_user_id: friendId,
        description: iouType,
        amount: Math.abs(newBalance),
        status: 'confirmed'
      }]);
    }

    await loadIOUs();
  };

  const handleDeclinePending = async (iouId: string) => {
    const { error } = await supabase
      .from('ious')
      .update({ status: 'disputed' })
      .eq('id', iouId);

    if (error) {
      console.error('Error declining pending:', error);
    } else {
      await loadIOUs();
    }
  };

  const handleCancelPending = async (iouId: string) => {
    const { error } = await supabase
      .from('ious')
      .delete()
      .eq('id', iouId);

    if (error) {
      console.error('Error canceling pending:', error);
    } else {
      await loadIOUs();
    }
  };

  const handleAcceptNewIOU = async (iouId: string) => {
    const { error } = await supabase
      .from('ious')
      .update({ status: 'confirmed' })
      .eq('id', iouId);

    if (error) {
      console.error('Error accepting new IOU:', error);
    } else {
      await loadIOUs();
    }
  };

  const handleDeclineNewIOU = async (iouId: string) => {
    const { error } = await supabase
      .from('ious')
      .delete()
      .eq('id', iouId);

    if (error) {
      console.error('Error declining new IOU:', error);
    } else {
      await loadIOUs();
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
      if (iou.status === 'confirmed') {
        if (iou.from_user_id === currentUser.id) {
          const existing = summaryMap.get(iou.to_user_id) || {
            userId: iou.to_user_id,
            username: iou.to_profile.username,
            balances: { Coffee: 0, Beer: 0, Meal: 0, Walk: 0, Ride: 0, Pizza: 0 },
            overallStatus: 'confirmed' as const
          };
          existing.balances[iou.description] = (existing.balances[iou.description] || 0) - iou.amount;
          summaryMap.set(iou.to_user_id, existing);
        } else if (iou.to_user_id === currentUser.id) {
          const existing = summaryMap.get(iou.from_user_id) || {
            userId: iou.from_user_id,
            username: iou.from_profile.username,
            balances: { Coffee: 0, Beer: 0, Meal: 0, Walk: 0, Ride: 0, Pizza: 0 },
            overallStatus: 'confirmed' as const
          };
          existing.balances[iou.description] = (existing.balances[iou.description] || 0) + iou.amount;
          summaryMap.set(iou.from_user_id, existing);
        }
      }
    });

    const summaryArray = Array.from(summaryMap.values()).filter((s) =>
      Object.values(s.balances).some(amount => amount !== 0)
    );

    return summaryArray;
  };

  const getPendingIOUs = () => {
    if (!currentUser) return [];
    return ious.filter(iou => iou.status === 'pending' || iou.status === 'pending_decrease');
  };

  const getNewPendingIOUs = () => {
    if (!currentUser) return [];
    return ious.filter(iou => iou.status === 'pending');
  };

  const getPendingDecreaseIOUs = () => {
    if (!currentUser) return [];
    return ious.filter(iou => iou.status === 'pending_decrease');
  };

  const getDisputedIOUs = () => {
    if (!currentUser) return [];
    return ious.filter(iou => iou.status === 'disputed');
  };

  const getPendingCount = () => {
    return getPendingIOUs().filter(iou => iou.requester_user_id !== currentUser?.id).length;
  };

  const summary = calculateSummary();
  const pendingIOUs = getPendingIOUs();
  const disputedIOUs = getDisputedIOUs();

  return (
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
            {(getPendingCount() > 0 || disputedIOUs.length > 0) && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">
                    {getPendingCount() > 0 && `You have ${getPendingCount()} pending confirmation${getPendingCount() > 1 ? 's' : ''} to review`}
                    {getPendingCount() > 0 && disputedIOUs.length > 0 && ' and '}
                    {disputedIOUs.length > 0 && `${disputedIOUs.length} disputed item${disputedIOUs.length > 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
            )}

            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending {(pendingIOUs.length + disputedIOUs.length) > 0 && `(${pendingIOUs.length + disputedIOUs.length})`}
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 flex flex-col">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Summary
                </h2>
                {summary.length === 0 && pendingIOUs.length === 0 && disputedIOUs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No IOUs yet</p>
                ) : (
                  <div className="space-y-4 overflow-y-auto max-h-96 pr-2">
                    {(filter === 'all' || filter === 'pending') && getNewPendingIOUs().length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          New IOUs Awaiting Acceptance
                        </h3>
                        {getNewPendingIOUs().map((iou) => {
                          const isRequester = iou.requester_user_id === currentUser?.id;
                          const otherUser = iou.from_user_id === currentUser?.id ? iou.to_profile : iou.from_profile;
                          const isPayer = iou.from_user_id === currentUser?.id;
                          return (
                            <div key={iou.id} className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium text-gray-800">{otherUser.username}</div>
                                  <div className="text-sm text-gray-600 flex items-center gap-1">
                                    <span className="text-lg">{IOU_EMOJIS[iou.description]}</span>
                                    <span>{isPayer ? 'You owe' : 'Owes you'}: {iou.amount} × {iou.description}</span>
                                  </div>
                                  {iou.optional_note && (
                                    <div className="text-xs text-gray-500 mt-1 italic">"{iou.optional_note}"</div>
                                  )}
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  isRequester ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {isRequester ? 'Sent' : 'Review'}
                                </span>
                              </div>
                              <div className="flex gap-2 mt-2">
                                {isRequester ? (
                                  <button
                                    onClick={() => handleCancelPending(iou.id)}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 px-3 rounded text-sm font-medium transition-colors"
                                  >
                                    Cancel
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleAcceptNewIOU(iou.id)}
                                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1"
                                    >
                                      <Check className="w-4 h-4" />
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => handleDeclineNewIOU(iou.id)}
                                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1"
                                    >
                                      <X className="w-4 h-4" />
                                      Decline
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(filter === 'all' || filter === 'pending') && getPendingDecreaseIOUs().length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Payment Confirmations
                        </h3>
                        {getPendingDecreaseIOUs().map((iou) => {
                          const isRequester = iou.requester_user_id === currentUser?.id;
                          const otherUser = iou.from_user_id === currentUser?.id ? iou.to_profile : iou.from_profile;
                          return (
                            <div key={iou.id} className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium text-gray-800">{otherUser.username}</div>
                                  <div className="text-sm text-gray-600 flex items-center gap-1">
                                    <span className="text-lg">{IOU_EMOJIS[iou.description]}</span>
                                    <span>-{iou.amount} × {iou.description}</span>
                                  </div>
                                  {iou.optional_note && (
                                    <div className="text-xs text-gray-500 mt-1 italic">"{iou.optional_note}"</div>
                                  )}
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  isRequester ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {isRequester ? 'Sent' : 'Review'}
                                </span>
                              </div>
                              <div className="flex gap-2 mt-2">
                                {isRequester ? (
                                  <button
                                    onClick={() => handleCancelPending(iou.id)}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 px-3 rounded text-sm font-medium transition-colors"
                                  >
                                    Cancel Request
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleApprovePending(iou.id)}
                                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1"
                                    >
                                      <Check className="w-4 h-4" />
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleDeclinePending(iou.id)}
                                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1"
                                    >
                                      <X className="w-4 h-4" />
                                      Decline
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(filter === 'all' || filter === 'pending') && disputedIOUs.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          Disputed Items
                        </h3>
                        {disputedIOUs.map((iou) => {
                          const isRequester = iou.requester_user_id === currentUser?.id;
                          const otherUser = iou.from_user_id === currentUser?.id ? iou.to_profile : iou.from_profile;
                          return (
                            <div key={iou.id} className="bg-red-50 border-l-4 border-red-400 rounded-lg p-3 mb-2">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium text-gray-800">{otherUser.username}</div>
                                  <div className="text-sm text-gray-600 flex items-center gap-1">
                                    <span className="text-lg">{IOU_EMOJIS[iou.description]}</span>
                                    <span>-{iou.amount} × {iou.description}</span>
                                  </div>
                                  {iou.optional_note && (
                                    <div className="text-xs text-gray-500 mt-1 italic">"{iou.optional_note}"</div>
                                  )}
                                </div>
                                <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                                  Disputed
                                </span>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleCancelPending(iou.id)}
                                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded text-sm font-medium transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(filter === 'all' || filter === 'settled') && summary.map((s) => (
                      <div key={s.userId} className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-l-green-400">
                        <div className="flex justify-between items-center mb-3">
                          <div className="font-semibold text-gray-800">{s.username}</div>
                        </div>
                        <div className="space-y-2">
                          {(Object.entries(s.balances) as [IOUType, number][])
                            .filter(([_, amount]) => amount !== 0)
                            .map(([type, amount]) => {
                              const isOwed = amount > 0;
                              return (
                                <div
                                  key={type}
                                  className={`rounded-lg border-l-4 ${
                                    isOwed ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
                                  }`}
                                >
                                  <div className="flex justify-between items-center p-2">
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className="text-2xl">{IOU_EMOJIS[type]}</span>
                                      <div className="flex flex-col">
                                        <span className="text-xs text-gray-600 font-medium">{type}</span>
                                        <span className="text-xs text-gray-500">
                                          {isOwed ? 'They owe you' : 'You owe them'}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="font-bold text-lg text-gray-800">
                                      {isOwed ? amount : -Math.abs(amount)}
                                    </span>
                                  </div>
                                  <div className="border-t border-gray-200 px-2 py-1.5 flex gap-2 justify-end bg-white bg-opacity-50">
                                    {isOwed ? (
                                      <>
                                        <button
                                          onClick={() => {
                                            setGenerousDecreaseModal({ friendId: s.userId, type, maxAmount: Math.abs(amount) });
                                            setGenerousDecreaseAmount(Math.min(1, Math.abs(amount)));
                                          }}
                                          className="flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-700 py-1 px-2 rounded text-xs font-medium transition-colors"
                                          title="Instant - no approval needed"
                                        >
                                          <Minus className="w-3 h-3" />
                                          Forgive
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelfishIncreaseModal({ friendId: s.userId, type });
                                          }}
                                          className="flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded text-xs font-medium transition-colors"
                                          title="Sends request for approval"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Add More
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => {
                                            setSettleUpModal({ friendId: s.userId, type, maxAmount: Math.abs(amount) });
                                            setSettleUpAmount(Math.min(1, Math.abs(amount)));
                                          }}
                                          className="flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded text-xs font-medium transition-colors"
                                          title="Sends request for approval"
                                        >
                                          <Check className="w-3 h-3" />
                                          Settle Up
                                        </button>
                                        <button
                                          onClick={() => {
                                            setGenerousIncreaseModal({ friendId: s.userId, type });
                                          }}
                                          className="flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-700 py-1 px-2 rounded text-xs font-medium transition-colors"
                                          title="Instant - no approval needed"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Add
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
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
                    {friends.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.username}
                      </option>
                    ))}
                  </select>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">What?</label>
                    <select
                      value={description}
                      onChange={(e) => setDescription(e.target.value as IOUType)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {IOU_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

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
          </div>

          {generousDecreaseModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Forgive {generousDecreaseModal.type}</h3>
                <p className="text-sm text-gray-600 mb-4">This will instantly reduce what they owe you. No approval needed.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount: {generousDecreaseAmount} × {generousDecreaseModal.type} {IOU_EMOJIS[generousDecreaseModal.type]}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={generousDecreaseModal.maxAmount}
                      value={generousDecreaseAmount}
                      onChange={(e) => setGenerousDecreaseAmount(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1</span>
                      <span>{generousDecreaseModal.maxAmount}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Optional Note
                    </label>
                    <input
                      type="text"
                      value={generousDecreaseNote}
                      onChange={(e) => setGenerousDecreaseNote(e.target.value)}
                      placeholder="e.g., No worries!"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setGenerousDecreaseModal(null);
                        setGenerousDecreaseAmount(1);
                        setGenerousDecreaseNote('');
                      }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerousDecrease}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Forgive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selfishIncreaseModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Add More</h3>
                <p className="text-sm text-gray-600 mb-4">Request to add 1 more {selfishIncreaseModal.type} to what they owe you. They must approve.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note (Required)
                    </label>
                    <input
                      type="text"
                      value={selfishIncreaseNote}
                      onChange={(e) => setSelfishIncreaseNote(e.target.value)}
                      placeholder="e.g., For helping with the project"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setSelfishIncreaseModal(null);
                        setSelfishIncreaseNote('');
                      }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSelfishIncrease}
                      disabled={!selfishIncreaseNote}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Request
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {generousIncreaseModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Add to My IOU</h3>
                <p className="text-sm text-gray-600 mb-4">This will instantly add 1 {generousIncreaseModal.type} to what you owe them. No approval needed.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Optional Note
                    </label>
                    <input
                      type="text"
                      value={generousIncreaseNote}
                      onChange={(e) => setGenerousIncreaseNote(e.target.value)}
                      placeholder="e.g., For the dinner last night"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setGenerousIncreaseModal(null);
                        setGenerousIncreaseNote('');
                      }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerousIncrease}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {settleUpModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Settle Up</h3>
                <p className="text-sm text-gray-600 mb-4">Request confirmation that you paid them back. They must approve.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount: {settleUpAmount} × {settleUpModal.type} {IOU_EMOJIS[settleUpModal.type]}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={settleUpModal.maxAmount}
                      value={settleUpAmount}
                      onChange={(e) => setSettleUpAmount(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1</span>
                      <span>{settleUpModal.maxAmount}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Optional Note
                    </label>
                    <input
                      type="text"
                      value={settleUpNote}
                      onChange={(e) => setSettleUpNote(e.target.value)}
                      placeholder="e.g., Paid at the coffee shop"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setSettleUpModal(null);
                        setSettleUpAmount(1);
                        setSettleUpNote('');
                      }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSettleUp}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Send Request
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
