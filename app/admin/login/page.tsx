"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MASTER_EMAIL    = 'admin@flashcart.com';
const MASTER_PASSWORD = 'Admin@1234';

export default function AdminLogin() {
  const router = useRouter();
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [setupKey,    setSetupKey]    = useState('');
  const [msg,         setMsg]         = useState('');
  const [msgType,     setMsgType]     = useState<'error' | 'success'>('error');
  const [loading,     setLoading]     = useState(false);
  const [showHint,    setShowHint]    = useState(false);
  const [showSetup,   setShowSetup]   = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    document.title = 'Admin Portal Login | FlashCart';
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      try {
        const res = await fetch('/api/admin/verify', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (data?.isAdmin) {
          window.location.href = '/admin';
        }
      } catch {
        // session invalid
      }
    });
  }, []);

  const showError   = (m: string) => { setMsg(m); setMsgType('error'); };
  const showSuccess = (m: string) => { setMsg(m); setMsgType('success'); };

  const handleLogin = async () => {
    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setMsg('');
    setPendingUser(null);
    setShowSetup(false);

    // 1. Authenticate with Supabase
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      showError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.session) {
      showError('No active session received. Please try again.');
      setLoading(false);
      return;
    }

    // 2. Verify admin role through server-side API (bypasses RLS)
    try {
      const verifyRes = await fetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${authData.session.access_token}` }
      });
      const verifyData = await verifyRes.json();

      if (verifyData.isAdmin) {
        showSuccess('Access granted! Redirecting to Command Center...');
        window.location.href = '/admin';
        return;
      }
    } catch (err: any) {
      console.error('Admin verification error:', err);
    }

    // If role is not admin, sign out and show message
    await supabase.auth.signOut();
    setPendingUser({ id: authData.user.id, email: authData.user.email ?? email });
    setShowSetup(true);
    showError('Access Denied. This account does not have Admin Wizard privileges.');
    setLoading(false);
  };

  const handleSetup = async () => {
    if (!pendingUser) return;
    setLoading(true);
    setMsg('');

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      showError('Authentication failed: ' + authError.message);
      setLoading(false);
      return;
    }

    const res = await fetch('/api/admin/first-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: authData.user.id,
        email: authData.user.email,
        setupKey: setupKey.trim()
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      await supabase.auth.signOut();
      showError(data.error ?? 'Setup failed.');
      setLoading(false);
      return;
    }

    showSuccess('Admin role granted! Redirecting...');
    setTimeout(() => {
      window.location.href = '/admin';
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 px-4">
      <div className="bg-slate-800 p-8 sm:p-10 rounded-2xl shadow-2xl w-full max-w-[420px] border border-slate-700">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0
                   01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622
                   5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Admin <span className="text-blue-500">Portal</span></h1>
          <p className="text-slate-400 text-sm mt-1">Warehouse Command Center</p>
        </div>

        {/* Login Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Email</label>
            <input
              className="bg-slate-900 border border-slate-700 text-white p-3 w-full rounded-lg outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              placeholder="admin@flashcart.com"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Password</label>
            <input
              className="bg-slate-900 border border-slate-700 text-white p-3 w-full rounded-lg outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg transition-all disabled:opacity-50 shadow-md shadow-blue-600/30"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </div>

        {/* Message */}
        {msg && (
          <p className={`mt-4 text-sm text-center font-bold p-3 rounded-lg ${
            msgType === 'success' ? 'text-green-400 bg-green-900/30 border border-green-700/50' : 'text-red-400 bg-red-900/30 border border-red-700/50'
          }`}>
            {msg}
          </p>
        )}

        {/* Setup Override Panel */}
        {showSetup && pendingUser && (
          <div className="mt-4 border border-yellow-600/40 bg-yellow-900/20 rounded-lg p-4 space-y-3">
            <p className="text-yellow-400 text-xs font-bold">🔧 Master Admin Setup Override</p>
            <p className="text-slate-400 text-xs">
              Enter the setup key from your <span className="font-mono text-white">.env.local</span> to force-grant admin access to <span className="font-mono text-white">{pendingUser.email}</span>.
            </p>
            <input
              className="bg-slate-900 border border-yellow-700/50 text-white p-2.5 w-full rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 placeholder-slate-500 text-sm font-mono"
              placeholder="Setup key (ADMIN_SETUP_KEY)"
              value={setupKey}
              onChange={e => setSetupKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetup()}
            />
            <div className="bg-slate-900 rounded p-2.5 text-xs font-mono border border-slate-700">
              <p className="text-slate-400">ADMIN_SETUP_KEY: <span className="text-yellow-400 font-bold">flashcart-setup-2024</span></p>
            </div>
            <button
              onClick={handleSetup}
              disabled={loading || !setupKey}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-2.5 rounded-lg text-sm transition-all disabled:opacity-40"
            >
              {loading ? 'Granting access...' : 'Grant Admin Access'}
            </button>
          </div>
        )}

        {/* Master Credential Hint */}
        <div className="mt-6 border-t border-slate-700 pt-4">
          <button
            className="text-slate-500 text-xs hover:text-slate-300 transition-colors w-full text-center"
            onClick={() => setShowHint(h => !h)}
          >
            {showHint ? '▲ Hide' : '▼ Default master login details'}
          </button>
          {showHint && (
            <div className="mt-3 bg-slate-900 rounded-lg p-4 text-xs font-mono space-y-1.5 border border-slate-700">
              <p className="text-slate-400">Master Email: <span className="text-blue-400 font-bold">{MASTER_EMAIL}</span></p>
              <p className="text-slate-400">Master Pass:&nbsp;&nbsp;<span className="text-blue-400 font-bold">{MASTER_PASSWORD}</span></p>
              <p className="text-slate-400 text-[11px] pt-1">New admins can also be added anytime via the <span className="text-white font-semibold">Add Admin Wizard</span> once signed in.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="no-print mt-6 text-center text-xs text-slate-400 font-semibold">
        Educational project for Sardar Patel Institute of Technology
      </footer>
    </div>
  );
}
