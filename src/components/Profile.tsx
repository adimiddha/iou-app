import { useState, useEffect, useRef } from 'react';
import { supabase, type Profile } from '../lib/supabase';
import { hashPhoneNumber, normalizePhoneNumber, validatePhoneNumber } from '../lib/phone-utils';
import PhoneInput from './PhoneInput';

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

/** Mask normalized phone for display (e.g. ***4567). */
function maskPhone(normalized: string): string {
  if (normalized.length < 4) return '****';
  return '***' + normalized.slice(-4);
}

/** Initials from username (e.g. "johndoe" -> "JD"). */
function initials(username: string): string {
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return username.slice(0, 2).toUpperCase();
}

function validateUsername(value: string): { ok: boolean; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: 'Username is required.' };
  if (trimmed.length < USERNAME_MIN) return { ok: false, error: `Username must be at least ${USERNAME_MIN} characters.` };
  if (trimmed.length > USERNAME_MAX) return { ok: false, error: `Username must be at most ${USERNAME_MAX} characters.` };
  if (!USERNAME_PATTERN.test(trimmed)) return { ok: false, error: 'Letters, numbers, and underscores only.' };
  return { ok: true };
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameEdit, setUsernameEdit] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, phone_normalized, phone_search_enabled')
      .eq('id', user.id)
      .maybeSingle();
    setProfile(data ?? null);
    setSearchEnabled(data?.phone_search_enabled !== false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const startEditUsername = () => {
    setUsernameEdit(profile?.username ?? '');
    setUsernameError('');
    setEditingUsername(true);
  };

  const cancelEditUsername = () => {
    setEditingUsername(false);
    setUsernameEdit('');
    setUsernameError('');
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const trimmed = usernameEdit.trim();
    const validation = validateUsername(usernameEdit);
    if (!validation.ok) {
      setUsernameError(validation.error ?? 'Invalid username.');
      return;
    }
    if (trimmed === profile.username) {
      cancelEditUsername();
      return;
    }
    setSavingUsername(true);
    setUsernameError('');
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmed)
        .maybeSingle();
      if (existing && existing.id !== profile.id) {
        setUsernameError('Username already taken. Please choose another.');
        setSavingUsername(false);
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .update({ username: trimmed })
        .eq('id', profile.id);
      if (error) {
        if (error.code === '23505') {
          setUsernameError('Username already taken. Please choose another.');
        } else {
          setUsernameError(error.message || 'Failed to update username.');
        }
        setSavingUsername(false);
        return;
      }
      await loadProfile();
      cancelEditUsername();
      showMessage('success', 'Username updated.');
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setSavingUsername(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Please choose an image file (JPEG, PNG, GIF, or WebP).');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      showMessage('error', 'Image must be 5 MB or smaller.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) {
        showMessage('error', uploadError.message || 'Failed to upload photo.');
        setUploadingPhoto(false);
        e.target.value = '';
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', profile.id);
      if (updateError) {
        showMessage('error', updateError.message || 'Failed to save photo.');
        setUploadingPhoto(false);
        e.target.value = '';
        return;
      }
      await loadProfile();
      showMessage('success', 'Photo updated.');
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
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

      {/* Premier: Photo + Username */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative shrink-0">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-amber-100 text-amber-800 flex items-center justify-center text-2xl font-semibold ring-2 ring-white shadow">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" />
            ) : (
              <span>{initials(profile.username)}</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={handlePhotoChange}
            className="absolute inset-0 w-24 h-24 rounded-full opacity-0 cursor-pointer"
            disabled={uploadingPhoto}
            aria-label="Upload profile photo"
          />
          {uploadingPhoto && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white text-sm">
              Uploading…
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          {!editingUsername ? (
            <>
              <p className="text-xl font-semibold text-gray-800 truncate">{profile.username}</p>
              <button
                type="button"
                onClick={startEditUsername}
                className="mt-1 text-sm text-blue-600 hover:text-blue-700"
              >
                Edit username
              </button>
              <p className="text-xs text-gray-500 mt-1 sm:block hidden">
                Tap the photo to change it. From camera roll or files.
              </p>
            </>
          ) : (
            <form onSubmit={handleSaveUsername} className="space-y-2">
              <input
                type="text"
                value={usernameEdit}
                onChange={(e) => setUsernameEdit(e.target.value)}
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
                pattern="[a-zA-Z0-9_]+"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                placeholder="johndoe"
                autoFocus
              />
              <p className="text-xs text-gray-500">Letters, numbers, underscores. 3–30 characters.</p>
              {usernameError && (
                <p className="text-sm text-red-600">{usernameError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingUsername}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingUsername ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditUsername}
                  disabled={savingUsername}
                  className="border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Find friends by phone (unchanged) */}
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
