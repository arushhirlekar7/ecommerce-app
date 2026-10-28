"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats,       setStats]       = useState({
    total: 0,
    lowStock: 0,
    expired: 0,
    expiringWeek: 0,
    totalExpiryAlerts: 0,
  });
  const [adminEmail,  setAdminEmail]  = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Warehouse Command Center | FlashCart Admin';
    checkAuth();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
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

      setAdminEmail(data.email ?? session.user.email ?? '');
      setAuthChecked(true);
      fetchStats();
    } catch {
      await supabase.auth.signOut();
      window.location.href = '/admin/login';
    }
  };

  const fetchStats = async () => {
    const { data } = await supabase.from('inventory').select('stock_quantity, expiry_date');
    if (data) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);

      const expiredCount = data.filter(item => {
        if (!item.expiry_date) return false;
        const d = new Date(item.expiry_date);
        return d < now;
      }).length;

      const expiringWeekCount = data.filter(item => {
        if (!item.expiry_date) return false;
        const d = new Date(item.expiry_date);
        return d >= now && d <= nextWeek;
      }).length;

      setStats({
        total:    data.length,
        lowStock: data.filter(item => item.stock_quantity < 10).length,
        expired:  expiredCount,
        expiringWeek: expiringWeekCount,
        totalExpiryAlerts: expiredCount + expiringWeekCount,
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  };

  const initials = adminEmail ? adminEmail[0].toUpperCase() : 'A';

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 font-bold text-lg animate-pulse">Loading Command Center...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Top Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Warehouse <span className="text-blue-600">Command Center</span>
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Inventory operations & staff administration</p>
          </div>

          {/* User Profile Avatar */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg flex items-center justify-center shadow-md transition-all ring-2 ring-blue-300 hover:ring-blue-500 cursor-pointer"
              title="Admin Profile"
            >
              {initials}
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                <div className="bg-slate-900 px-5 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-base flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">Admin Wizard</p>
                    <p className="text-slate-400 text-xs truncate">{adminEmail}</p>
                  </div>
                </div>
                <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
                  <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    Master Access
                  </span>
                </div>
                <div className="p-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm font-bold text-left cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out Admin
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard 3-Block Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Active Catalog */}
          <Link
            href="/admin/products"
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold uppercase text-xs tracking-wider group-hover:text-blue-600">Active Catalog</span>
                <span className="text-blue-600 font-bold text-sm group-hover:translate-x-1 transition-transform">&rarr;</span>
              </div>
              <p className="text-4xl font-black text-slate-900 mt-3">{stats.total} Products</p>
            </div>
            <p className="text-xs text-slate-500 mt-4">Click to view and manage all inventory products.</p>
          </Link>

          {/* Card 2: Low Stock Alert */}
          <Link
            href="/admin/products?filter=low"
            className="bg-white p-6 rounded-2xl shadow-sm border border-red-200 hover:shadow-md hover:border-red-400 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center">
                <span className="text-red-500 font-bold uppercase text-xs tracking-wider group-hover:text-red-700">Low Stock Alert (&lt;10)</span>
                <span className="text-red-600 font-bold text-sm group-hover:translate-x-1 transition-transform">&rarr;</span>
              </div>
              <p className="text-4xl font-black text-red-600 mt-3">{stats.lowStock} Exhausting</p>
            </div>
            <p className="text-xs text-slate-500 mt-4">Click to view items requiring immediate restock.</p>
          </Link>

          {/* Card 3: Expiry Alerts (Expired + Expiring This Week) */}
          <Link
            href="/admin/products?filter=expiring"
            className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200 hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center">
                <span className="text-amber-600 font-bold uppercase text-xs tracking-wider group-hover:text-amber-800">
                  Expiry Alerts
                </span>
                <span className="text-amber-600 font-bold text-sm group-hover:translate-x-1 transition-transform">&rarr;</span>
              </div>
              <p className="text-4xl font-black text-amber-600 mt-3">
                {stats.totalExpiryAlerts} <span className="text-2xl font-bold">Alerts</span>
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {stats.expired > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ⚠️ {stats.expired} Expired
                </span>
              )}
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                ⏳ {stats.expiringWeek} This Week
              </span>
            </div>
          </Link>
        </div>

        {/* Action Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/add-product"
            className="bg-slate-900 p-6 rounded-2xl shadow-sm hover:bg-slate-800 transition-all cursor-pointer text-white flex flex-col justify-between group"
          >
            <div>
              <h3 className="font-bold text-lg mb-1 flex items-center justify-between">
                <span>+ Add New Product</span>
                <span className="group-hover:translate-x-1 transition-transform text-slate-400">&rarr;</span>
              </h3>
              <p className="text-slate-400 text-sm">Register new inventory items and set prices & expiry dates.</p>
            </div>
          </Link>

          <Link
            href="/admin/users"
            className="bg-blue-600 p-6 rounded-2xl shadow-sm hover:bg-blue-700 transition-all cursor-pointer text-white flex flex-col justify-between group"
          >
            <div>
              <h3 className="font-bold text-lg mb-1 flex items-center justify-between">
                <span>+ Add Admin Wizard</span>
                <span className="group-hover:translate-x-1 transition-transform text-blue-200">&rarr;</span>
              </h3>
              <p className="text-blue-100 text-sm">Create staff admin accounts with full Command Center access.</p>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <footer className="no-print mt-12 pt-6 text-center text-xs text-slate-500 border-t border-slate-200">
          <p className="font-bold text-slate-700">Educational project for Sardar Patel Institute of Technology</p>
        </footer>

      </div>
    </div>
  );
}
