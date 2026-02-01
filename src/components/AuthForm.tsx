import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { normalizePhoneNumber, validatePhoneNumber } from '../lib/phone-utils';
import PhoneInput from './PhoneInput';
import { Check, X, Eye, EyeOff } from 'lucide-react';

type AuthFormProps = {
  onAuthSuccess: () => void;
  onBackToLanding?: () => void;
};

export default function AuthForm({ onAuthSuccess, onBackToLanding }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    feedback: string[];
  }>({ score: 0, feedback: [] });
  const [passwordRejectedAsWeak, setPasswordRejectedAsWeak] = useState(false);

  const calculatePasswordStrength = (pwd: string) => {
    const feedback: string[] = [];
    let score = 0;

    if (pwd.length >= 6) {
      score++;
    } else {
      feedback.push('At least 6 characters');
    }

    if (/[a-z]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Add lowercase letters');
    }

    if (/[A-Z]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Add uppercase letters');
    }

    if (/[0-9]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Add numbers');
    }

    if (/[^A-Za-z0-9]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Add special characters (!@#$%)');
    }

    return { score, feedback };
  };

  useEffect(() => {
    if (password && isSignUp) {
      setPasswordStrength(calculatePasswordStrength(password));
      setPasswordRejectedAsWeak(false);
    }
  }, [password, isSignUp]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPasswordRejectedAsWeak(false);
    setLoading(true);

    try {
      if (isSignUp) {
        if (phone.trim()) {
          if (!validatePhoneNumber(phone)) {
            setError('Please enter a valid 10-digit number.');
            setLoading(false);
            return;
          }
          const normalized = normalizePhoneNumber(phone);
          sessionStorage.setItem('iou_signup_phone', normalized);
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      }

      onAuthSuccess();
    } catch (err: any) {
      const msg = err.message || 'Authentication failed';
      setError(msg);
      const isWeakOrPwned =
        msg.toLowerCase().includes('weak') ||
        msg.toLowerCase().includes('easy to guess') ||
        err?.code === 'weak_password';
      setPasswordRejectedAsWeak(!!isWeakOrPwned);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
      {onBackToLanding && (
        <p className="mb-4">
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            ← Back
          </button>
        </p>
      )}
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
        {isSignUp ? 'Sign Up' : 'Sign In'}
      </h2>

      {isSignUp && (
        <p className="text-sm text-gray-600 mb-4 text-center">
          Sign up creates a new account. Use sign in if you already have one.
        </p>
      )}

      <button
        onClick={handleGoogleAuth}
        disabled={loading}
        type="button"
        className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mb-6"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {loading ? 'Loading...' : 'Continue with Google'}
      </button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        {isSignUp && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-gray-500 font-normal">(optional — so friends can find you)</span>
            </label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              placeholder="(xxx) xxx-xxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}


        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 rounded"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {isSignUp && password && (
            <div className="mt-2">
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      level <= passwordStrength.score
                        ? passwordStrength.score <= 2
                          ? 'bg-red-500'
                          : passwordStrength.score === 3
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              {passwordStrength.feedback.length > 0 && (
                <div className="text-xs space-y-1">
                  {passwordStrength.feedback.map((tip, index) => (
                    <div key={index} className="flex items-center gap-1 text-gray-600">
                      <X className="w-3 h-3 text-red-500" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}
              {passwordStrength.score >= 4 && !passwordRejectedAsWeak && (
                <div className="text-xs flex items-center gap-1 text-green-600">
                  <Check className="w-3 h-3" />
                  <span>Strong password!</span>
                </div>
              )}
              {passwordStrength.score >= 4 && passwordRejectedAsWeak && error && (
                <div className="text-xs flex items-center gap-1 text-amber-600 mt-1">
                  <X className="w-3 h-3 shrink-0" />
                  <span>This password was rejected: it appears in a breach database. Use a unique password or a password manager.</span>
                </div>
              )}
              {passwordStrength.score >= 4 && !passwordRejectedAsWeak && (
                <p className="text-xs text-gray-500 mt-1">We also check against known breached passwords.</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {isSignUp
            ? 'Already have an account? Sign in'
            : "Don't have an account? Sign up"}
        </button>
      </div>

      <p className="mt-6 text-center">
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Privacy Policy
        </a>
      </p>
    </div>
  );
}
