import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { Mail, Lock, ArrowRight, Loader2, LogIn } from 'lucide-react';
import Logo from './logo';

const AuthScreen: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err.code as string;
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setError('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else if (code === 'auth/user-disabled') {
        setError('This account has been disabled. Contact your manager.');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      {/* Soft background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[500px] h-[500px] bg-brand/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] bg-brand/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md w-full">

        {/* Logo + title */}
        <div className="text-center mb-10">
          <Logo size={80} className="mx-auto mb-6" />
          <h1 className="text-3xl font-black tracking-tight text-stone-900">Al Kabir</h1>
          <p className="text-stone-400 mt-2 text-sm font-semibold tracking-wide uppercase">
            Bistro &nbsp;·&nbsp; Manager Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-stone-100">

          <div className="mb-8">
            <h2 className="text-xl font-black text-stone-900">Welcome back</h2>
            <p className="text-stone-400 text-sm mt-1 font-medium">
              Sign in to access your dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand-light transition-all text-sm font-medium text-stone-900 placeholder:text-stone-300"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand-light transition-all text-sm font-medium text-stone-900 placeholder:text-stone-300"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-light text-white font-black py-4 rounded-2xl shadow-xl shadow-brand/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-stone-400 mt-6 font-medium">
          Access is restricted to authorised staff only.
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;