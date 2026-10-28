"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminUsersPage() {
  const [userForm,  setUserForm]  = useState({ email: '', password: '', role: 'admin' });
  const [msg,       setMsg]       = useState('');
  const [msgType,   setMsgType]   = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthOk,  setIsAuthOk]  = useState(false);

  useEffect(() => {
    document.title = 'Add Admin Wizard | FlashCart Admin';
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.href = '/admin/login';
        return;
      }
      try {
        const res = await fetch('/api/admin/verify', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (!data.isAdmin) {
          await supabase.auth.signOut();
          window.location.href = '/admin/login';
          return;
        }
        setIsAuthOk(true);
      } catch {
        window.location.href = '/admin/login';
      }
    });
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg('Creating account and provisioning access...');
    setMsgType('success');

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMsgType('success');
        setMsg(data.message || `Account for ${userForm.email} created! They can now log in at the Admin Portal.`);
        setUserForm({ email: '', password: '', role: 'admin' });
      } else {
        setMsgType('error');
        setMsg(data.error || 'Failed to create user account.');
      }
    } catch (err: any) {
      setMsgType('error');
      setMsg(err.message || 'Network error while creating account.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthOk) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 font-bold text-lg animate-pulse">Checking wizard permissions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline">
            &larr; Back to Command Center
          </Link>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Staff Management
          </span>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
              ⚡
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Add Admin Wizard</h1>
              <p className="text-slate-500 text-xs">Provision elevated warehouse staff accounts</p>
            </div>
          </div>

          <p className="text-slate-600 text-sm mt-3 mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            Staff members created here with the <span className="font-bold text-blue-600">Admin Wizard</span> role can immediately log into the <span className="font-semibold text-slate-900">Admin Portal</span> (`/admin/login`) with full warehouse management capabilities.
          </p>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Staff Email Address
              </label>
              <input
                required
                type="email"
                value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
                placeholder="staff@flashcart.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Temporary Password
              </label>
              <input
                required
                type="password"
                minLength={6}
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                System Role
              </label>
              <select
                value={userForm.role}
                onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                className="w-full border border-slate-300 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="admin">Admin Wizard (Full Command Center Access)</option>
                <option value="user">Standard User (Storefront Only)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl mt-4 transition-all disabled:opacity-50 shadow-md shadow-blue-600/30 cursor-pointer"
            >
              {isLoading ? 'Authorizing New Account...' : 'Grant Dashboard Access'}
            </button>
          </form>

          {msg && (
            <div className={`mt-6 p-4 rounded-xl text-sm font-bold text-center border ${
              msgType === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {msg}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="no-print mt-10 pt-6 text-center text-xs text-slate-500 border-t border-slate-200">
          <p className="font-bold text-slate-700">Educational project for Sardar Patel Institute of Technology</p>
        </footer>
      </div>
    </div>
  );
}
