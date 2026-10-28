"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

function ProductsTable() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter'); // 'low' | 'expiring' | null

  const [products,       setProducts]       = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [notification,   setNotification]   = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Inline Stock Edit State: product_id -> new stock value
  const [editingStock,   setEditingStock]   = useState<Record<number, string>>({});
  const [savingStock,    setSavingStock]    = useState<Record<number, boolean>>({});

  // Inline Expiry Date Edit State: product_id -> new date string (YYYY-MM-DD)
  const [editingExpiry,  setEditingExpiry]  = useState<Record<number, string>>({});
  const [savingExpiry,   setSavingExpiry]   = useState<Record<number, boolean>>({});

  const [deletingId,     setDeletingId]     = useState<number | null>(null);

  useEffect(() => {
    document.title = filter === 'low'
      ? 'Low Stock Alerts | Inventory Database'
      : filter === 'expiring'
      ? 'Expiry Alerts | Inventory Database'
      : 'Inventory Database | FlashCart Admin';

    // Auth guard via server-side verify
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
        fetchProducts();
      } catch {
        window.location.href = '/admin/login';
      }
    });
  }, [filter]);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Expiry check helpers
  const isExpired = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    return d < today;
  };

  const isExpiringThisWeek = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today);
    weekAhead.setDate(today.getDate() + 7);
    weekAhead.setHours(23, 59, 59, 999);
    const d = new Date(dateStr);
    return d >= today && d <= weekAhead;
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError('');

    // Fetch inventory and products separately to prevent schema relationship issues
    const [invResult, prodResult] = await Promise.all([
      supabase.from('inventory').select('inventory_id, stock_quantity, expiry_date, product_id'),
      supabase.from('products').select('product_id, product_name, category, unit_price'),
    ]);

    if (invResult.error && prodResult.error) {
      setError(invResult.error.message);
      setLoading(false);
      return;
    }

    const inventory = invResult.data ?? [];
    const productsList = prodResult.data ?? [];

    const productMap: Record<number, any> = {};
    for (const p of productsList) {
      productMap[p.product_id] = p;
    }

    let rows = inventory.map(inv => {
      const prod = productMap[inv.product_id] ?? {};
      return {
        inventory_id: inv.inventory_id,
        product_id:   inv.product_id,
        product_name: prod.product_name ?? `Product #${inv.product_id}`,
        category:     prod.category     ?? 'General',
        unit_price:   prod.unit_price   ?? 0,
        stock:        inv.stock_quantity ?? 0,
        expiry:       inv.expiry_date   ?? 'N/A',
      };
    });

    if (rows.length === 0 && productsList.length > 0) {
      rows = productsList.map(p => ({
        inventory_id: null,
        product_id:   p.product_id,
        product_name: p.product_name,
        category:     p.category ?? 'General',
        unit_price:   p.unit_price ?? 0,
        stock:        0,
        expiry:       'N/A',
      }));
    }

    // Filter: Low Stock
    if (filter === 'low') {
      rows = rows.filter(r => r.stock < 10);
    }

    // Filter: Expiring Tab (Includes BOTH Expired and Expiring within 7 days)
    if (filter === 'expiring') {
      rows = rows.filter(r => isExpired(r.expiry) || isExpiringThisWeek(r.expiry));
    }

    setProducts(rows);
    setLoading(false);
  };

  // ── Inline Stock Handlers ──
  const handleStartEditStock = (productId: number, currentStock: number) => {
    setEditingStock(prev => ({ ...prev, [productId]: String(currentStock) }));
  };

  const handleCancelEditStock = (productId: number) => {
    setEditingStock(prev => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  };

  const handleUpdateStock = async (productId: number, newStockQty: number, inventoryId?: number) => {
    if (isNaN(newStockQty) || newStockQty < 0) {
      notify('Stock must be a non-negative number.', 'error');
      handleCancelEditStock(productId);
      return;
    }

    setSavingStock(prev => ({ ...prev, [productId]: true }));

    try {
      const res = await fetch('/api/admin/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          inventory_id: inventoryId,
          stock_quantity: newStockQty,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(prev =>
          prev.map(p => (p.product_id === productId ? { ...p, stock: newStockQty } : p))
        );
        notify(`Stock for product #${productId} updated to ${newStockQty}!`, 'success');
      } else {
        notify(data.message || 'Failed to update stock', 'error');
      }
    } catch (err: any) {
      notify(err.message || 'Failed to update stock', 'error');
    } finally {
      setSavingStock(prev => ({ ...prev, [productId]: false }));
      handleCancelEditStock(productId);
    }
  };

  // ── Inline Expiry Date Handlers ──
  const handleStartEditExpiry = (productId: number, currentExpiry: string) => {
    const defaultDate = (currentExpiry && currentExpiry !== 'N/A')
      ? currentExpiry
      : new Date().toISOString().split('T')[0];
    setEditingExpiry(prev => ({ ...prev, [productId]: defaultDate }));
  };

  const handleCancelEditExpiry = (productId: number) => {
    setEditingExpiry(prev => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  };

  const handleSaveExpiry = async (productId: number, inventoryId?: number) => {
    const newDate = editingExpiry[productId];
    if (!newDate) {
      handleCancelEditExpiry(productId);
      return;
    }

    setSavingExpiry(prev => ({ ...prev, [productId]: true }));

    try {
      const res = await fetch('/api/admin/update-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          inventory_id: inventoryId,
          expiry_date: newDate,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(prev =>
          prev.map(p => (p.product_id === productId ? { ...p, expiry: newDate } : p))
        );
        notify(`Expiry date updated to ${newDate}!`, 'success');
      } else {
        notify(data.error || 'Failed to update expiry date', 'error');
      }
    } catch (err: any) {
      notify(err.message || 'Network error updating expiry date', 'error');
    } finally {
      setSavingExpiry(prev => ({ ...prev, [productId]: false }));
      handleCancelEditExpiry(productId);
    }
  };

  // ── Delete Product Handler ──
  const handleDeleteProduct = async (productId: number, productName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${productName}"?\n\nThis will remove the product and its inventory completely.`
    );
    if (!confirmed) return;

    setDeletingId(productId);

    try {
      const res = await fetch('/api/admin/products/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(prev => prev.filter(p => p.product_id !== productId));
        notify(`"${productName}" deleted successfully.`, 'success');
      } else {
        notify(data.error || 'Failed to delete product', 'error');
      }
    } catch (err: any) {
      notify(err.message || 'Error deleting product', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Inventory <span className="text-blue-600">Database</span>
              </h1>
              <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-full">
                {products.length} {products.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live warehouse stock levels, expiry date management & inline editing
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/add-product"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-lg transition-all shadow-sm"
            >
              + Add Product
            </Link>
            <Link
              href="/admin"
              className="text-blue-600 font-bold text-xs sm:text-sm hover:underline"
            >
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Active Filter Pill */}
        {filter && (
          <div className="mb-4 flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 ${
              filter === 'low'
                ? 'bg-red-100 text-red-800 border border-red-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              <span>
                {filter === 'low'
                  ? '⚡ Filter: Low Stock (<10 units)'
                  : '⏳ Filter: Expiry Alerts (Expired Goods & Expiring This Week)'}
              </span>
              <Link
                href="/admin/products"
                className="font-bold underline text-xs ml-1 hover:text-black"
                title="Clear filter"
              >
                Clear (View All)
              </Link>
            </span>
          </div>
        )}

        {/* Notification Banner */}
        {notification && (
          <div className={`mb-4 p-3 rounded-lg text-sm font-bold transition-all shadow-sm ${
            notification.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}>
            {notification.text}
          </div>
        )}

        {/* Products Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-bold animate-pulse">
              Loading inventory records...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 font-bold">
              Error: {error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold">Product Name</th>
                    <th className="p-4 font-bold">Category</th>
                    <th className="p-4 font-bold">Price</th>
                    <th className="p-4 font-bold">Stock Count (Inline Edit)</th>
                    <th className="p-4 font-bold">Expiry Date & Status (Inline Edit)</th>
                    <th className="p-4 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
                        {filter === 'low'
                          ? 'No low stock items! All products have 10+ units.'
                          : filter === 'expiring'
                          ? 'No expired or expiring products found.'
                          : 'No products registered yet. Click "+ Add Product" to get started.'}
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const isEditingStock  = p.product_id in editingStock;
                      const isSavingStock   = savingStock[p.product_id];
                      const isEditingExp    = p.product_id in editingExpiry;
                      const isSavingExp     = savingExpiry[p.product_id];
                      const isDeleting      = deletingId === p.product_id;

                      const expired         = isExpired(p.expiry);
                      const expiringSoon    = !expired && isExpiringThisWeek(p.expiry);

                      return (
                        <tr
                          key={p.product_id}
                          className={`transition-colors ${
                            expired
                              ? 'bg-red-50/50 hover:bg-red-50'
                              : expiringSoon
                              ? 'bg-amber-50/40 hover:bg-amber-50'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Product Name */}
                          <td className="p-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              {expired && (
                                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" title="Expired Item"></span>
                              )}
                              <span>{p.product_name}</span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="p-4 text-slate-600">
                            <span className="capitalize">{p.category}</span>
                          </td>

                          {/* Price */}
                          <td className="p-4 text-slate-900 font-bold">
                            {p.unit_price ? `₹${Number(p.unit_price).toFixed(2)}` : '₹0.00'}
                          </td>

                          {/* Stock Left & Stepper Controls */}
                          <td className="p-4">
                            {isEditingStock ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  autoFocus
                                  value={editingStock[p.product_id]}
                                  onChange={(e) =>
                                    setEditingStock(prev => ({
                                      ...prev,
                                      [p.product_id]: e.target.value
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateStock(
                                        p.product_id,
                                        parseInt(editingStock[p.product_id], 10),
                                        p.inventory_id
                                      );
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditStock(p.product_id);
                                    }
                                  }}
                                  className="w-20 border-2 border-blue-500 rounded-lg px-2 py-1 text-sm font-bold outline-none text-slate-900 bg-white"
                                />
                                <button
                                  onClick={() =>
                                    handleUpdateStock(
                                      p.product_id,
                                      parseInt(editingStock[p.product_id], 10),
                                      p.inventory_id
                                    )
                                  }
                                  disabled={isSavingStock}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                  {isSavingStock ? '...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => handleCancelEditStock(p.product_id)}
                                  className="text-slate-400 hover:text-slate-600 text-xs px-1"
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    handleUpdateStock(p.product_id, Math.max(0, p.stock - 1), p.inventory_id)
                                  }
                                  disabled={p.stock <= 0 || isSavingStock}
                                  title="Decrease by 1"
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                                >
                                  -
                                </button>

                                <button
                                  onClick={() => handleStartEditStock(p.product_id, p.stock)}
                                  title="Click to edit stock count directly"
                                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 hover:ring-2 hover:ring-blue-300 ${
                                    p.stock < 10
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                                  }`}
                                >
                                  <span>{p.stock} units</span>
                                  <span className="text-[10px] opacity-60">✎</span>
                                </button>

                                <button
                                  onClick={() =>
                                    handleUpdateStock(p.product_id, p.stock + 1, p.inventory_id)
                                  }
                                  disabled={isSavingStock}
                                  title="Increase by 1"
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  +
                                </button>

                                {isSavingStock && (
                                  <span className="text-xs text-blue-600 font-bold animate-pulse">
                                    Saving...
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Expiry Date & Inline Expiry Date Editor */}
                          <td className="p-4">
                            {isEditingExp ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  autoFocus
                                  value={editingExpiry[p.product_id]}
                                  onChange={(e) =>
                                    setEditingExpiry(prev => ({
                                      ...prev,
                                      [p.product_id]: e.target.value
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveExpiry(p.product_id, p.inventory_id);
                                    if (e.key === 'Escape') handleCancelEditExpiry(p.product_id);
                                  }}
                                  className="border-2 border-blue-500 rounded-lg px-2 py-1 text-xs font-semibold outline-none bg-white text-slate-800"
                                />
                                <button
                                  onClick={() => handleSaveExpiry(p.product_id, p.inventory_id)}
                                  disabled={isSavingExp}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                  {isSavingExp ? '...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => handleCancelEditExpiry(p.product_id)}
                                  className="text-slate-400 hover:text-slate-600 text-xs px-1"
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`font-mono text-xs font-semibold ${
                                  expired ? 'text-red-700 font-bold' : 'text-slate-700'
                                }`}>
                                  {p.expiry}
                                </span>

                                {/* Red Flag for Expired Goods */}
                                {expired && (
                                  <span className="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm flex items-center gap-1">
                                    <span>⚠️</span> EXPIRED
                                  </span>
                                )}

                                {/* Amber Flag for Expiring This Week */}
                                {expiringSoon && (
                                  <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Expiring Soon
                                  </span>
                                )}

                                {/* Edit Expiry Date Button */}
                                <button
                                  onClick={() => handleStartEditExpiry(p.product_id, p.expiry)}
                                  className="text-slate-400 hover:text-blue-600 text-xs font-bold ml-1 p-1 hover:bg-blue-50 rounded transition-colors"
                                  title="Change expiry date"
                                >
                                  ✎ Change Date
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Actions: Delete Button */}
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeleteProduct(p.product_id, p.product_name)}
                              disabled={isDeleting}
                              title="Delete product"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all cursor-pointer disabled:opacity-40"
                            >
                              {isDeleting ? (
                                <span className="text-xs font-bold text-red-400">Deleting...</span>
                              ) : (
                                <svg
                                  className="w-4 h-4 inline"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Helper Note */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <p>
            💡 Tip: Click <span className="font-bold text-slate-600">[✎ Change Date]</span> to update any expiry date. Expired goods are automatically flagged in red.
          </p>
          <p>
            Use <span className="font-bold text-slate-600">[-]</span> and <span className="font-bold text-slate-600">[+]</span> to adjust quantities live.
          </p>
        </div>

        {/* Footer */}
        <footer className="no-print mt-10 pt-6 text-center text-xs text-slate-500 border-t border-slate-200">
          <p className="font-bold text-slate-700">Educational project for Sardar Patel Institute of Technology</p>
        </footer>

      </div>
    </div>
  );
}

export default function ProductsList() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-bold">
          Loading Inventory Database...
        </div>
      }
    >
      <ProductsTable />
    </Suspense>
  );
}
