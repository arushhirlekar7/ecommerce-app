"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AddProductPage() {
  const [productForm, setProductForm] = useState({ name: '', category: '', price: '', stock: '', expiry: '' });
  const [msg,         setMsg]         = useState('');
  const [isAuthOk,    setIsAuthOk]    = useState(false);

  useEffect(() => {
    document.title = 'Register New Inventory | FlashCart Admin';
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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('Adding product to inventory...');

    const { data: pData, error: pError } = await supabase.from('products')
      .insert([{
        product_name: productForm.name,
        category: productForm.category,
        unit_price: parseFloat(productForm.price)
      }]).select().single();

    if (pError) return setMsg(pError.message);

    const { error: iError } = await supabase.from('inventory').insert([{
      center_id: 1,
      product_id: pData.product_id,
      stock_quantity: parseInt(productForm.stock, 10),
      manufacturing_date: new Date().toISOString().split('T')[0],
      expiry_date: productForm.expiry
    }]);

    if (iError) {
      setMsg(iError.message);
    } else {
      setMsg('Product added successfully to warehouse vault!');
      setProductForm({ name: '', category: '', price: '', stock: '', expiry: '' });
    }
  };

  if (!isAuthOk) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 font-bold text-lg animate-pulse">Checking admin access...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold hover:underline mb-6 inline-block text-sm">
          &larr; Back to Dashboard
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-black text-slate-900 mb-6">Register New Inventory</h1>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Product Name</label>
              <input required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Organic Almond Milk" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Category</label>
                <input required value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Dairy, Electronics" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Price ($)</label>
                <input required type="number" step="0.01" min="0" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Initial Stock Quantity</label>
                <input required type="number" min="0" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: e.target.value})} className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="100" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Expiry Date</label>
                <input required type="date" value={productForm.expiry} onChange={e => setProductForm({...productForm, expiry: e.target.value})} className="w-full border p-3 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl mt-4 transition-all shadow-md">
              Add to Vault
            </button>
          </form>

          {msg && (
            <div className={`mt-6 p-4 rounded-xl font-bold text-center text-sm ${
              msg.includes('successfully') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
