import { useState, useEffect } from 'react';
import { supabase, type Profile } from '../lib/supabase';
import { hashPhoneNumber, normalizePhoneNumber, validatePhoneNumber } from '../lib/phone-utils';
import PhoneInput from './PhoneInput';

/** Mask normalized phone for display (e.g. ***4567). */
function maskPhone(normalized: string): string {
  if (normalized.length < 4) return '****';
  return '***' + normalized.slice(-4);
}

export default function PhoneSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, username, phone_normalized, phone_search_enabled')
      .eq('id', user.id)
      .maybeSingle();
    setProfile(data ?? null);
    setSearchEnabled(data?.phone_search_enabled !== false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (phone.length !== 10) {
      showMessage('error', 'Enter a 10-digit phone number.');
      return;
    }
    if (!validatePhoneNumber(phone)) {
      showMessage('error', 'Please enter a valid 10-digit number.');
      return;
    }
    setLoading(true);
    try {
      const normalized = normalizePhoneNumber(phone);
      const phoneHash = await hashPhoneNumber(phone);
      const { error } = await supabase
        .from('profiles')
        .update({
          phone_hash: phoneHash,
          phone_normalized: normalized,
          phone_search_enabled: searchEnabled,
        })
        .eq('id', profile.id);
      if (error) {
        if (error.code === '23505' && error.message?.includes('phone_hash')) {
          showMessage('error', 'This number is already linked to another account.');
        } else {
          showMessage('error', error.message || 'Failed to save.');
        }
        setLoading(false);
        return;
      }
      await loadProfile();
      setPhone('');
      showMessage('success', 'Phone number saved. Friends can find you by number.');
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to save.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSearch = async () => {
    if (!profile) return;
    const next = !searchEnabled;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_search_enabled: next })
        .eq('id', profile.id);
      if (error) throw error;
      setSearchEnabled(next);
      showMessage('success', next ? 'Phone search enabled.' : 'Phone search disabled.');
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to update.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePhone = async () => {
    if (!profile || !confirm('Remove your phone number? Friends will no longer be able to find you by number.')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_hash: null, phone_normalized: null, phone_search_enabled: true })
        .eq('id', profile.id);
      if (error) throw error;
      await loadProfile();
      setPhone('');
      showMessage('success', 'Phone number removed.');
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to remove.');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="text-gray-600 text-center py-8">Loading...</div>
    );
  }

  const hasPhone = !!profile.phone_normalized;

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

      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Find friends by phone</h2>
        <p className="text-gray-600 text-sm mb-4">
          Add your phone number so friends can find you. We never share your number — search uses a secure hash.
        </p>

        {hasPhone && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              Your number: <span className="font-mono">{maskPhone(profile.phone_normalized!)}</span>
            </p>
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={searchEnabled}
                onChange={handleToggleSearch}
                disabled={loading}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Let friends find me by phone number</span>
            </label>
            <button
              type="button"
              onClick={handleRemovePhone}
              disabled={loading}
              className="mt-2 text-sm text-red-600 hover:text-red-700"
            >
              Remove phone number
            </button>
          </div>
        )}

        <form onSubmit={handleSavePhone} className="flex gap-2">
          <PhoneInput
            value={phone}
            onChange={setPhone}
            placeholder="(xxx) xxx-xxxx"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || phone.length !== 10}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : hasPhone ? 'Update' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
