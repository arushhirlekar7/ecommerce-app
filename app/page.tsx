"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface ProductItem {
  product_id: number;
  product_name: string;
  category: string;
  unit_price: number;
  stock: number;
  expiry: string;
}

interface CartItem extends ProductItem {
  cartQuantity: number;
}

interface OrderReceipt {
  receiptNumber: string;
  orderId: string | number;
  orderDate: string;
  customer_id: string;
  shipping_pincode: string;
  items: {
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
  totalAmount: number;
  paymentMethod: string;
  fulfillmentStatus: string;
}

export default function Home() {
  const [session,         setSession]         = useState<any>(null);
  const [products,        setProducts]        = useState<ProductItem[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Cart State (Persisted per user or guest)
  const [cart,            setCart]            = useState<CartItem[]>([]);
  const [isCartOpen,      setIsCartOpen]      = useState(false);
  const [isCheckingOut,   setIsCheckingOut]   = useState(false);

  // Auth Modal State (when guest clicks Buy or Add to Cart)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode,        setAuthMode]        = useState<'login' | 'signup'>('login');
  const [authEmail,       setAuthEmail]       = useState('');
  const [authPassword,    setPassword]        = useState('');
  const [authMsg,         setAuthMsg]         = useState('');
  const [authLoading,     setAuthLoading]     = useState(false);

  // Pincode Prompt Modal State
  const [isPincodeModalOpen, setIsPincodeModalOpen] = useState(false);
  const [shippingPincode,    setShippingPincode]    = useState('');
  const [pincodeError,       setPincodeError]       = useState('');
  const [pendingCheckoutItem, setPendingCheckoutItem] = useState<ProductItem | null>(null);

  // Printable Receipt State
  const [receiptData,        setReceiptData]        = useState<OrderReceipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Global Toast Notification
  const [toast,           setToast]           = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    document.title = 'FlashCart | Live Flash Sale Store';

    // 1. Initial auth session check
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      loadUserCart(currentSession?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      loadUserCart(currentSession?.user?.id);
    });

    // 2. Load cached pincode if saved
    try {
      const savedPin = localStorage.getItem('flashcart_pincode');
      if (savedPin) setShippingPincode(savedPin);
    } catch {}

    fetchInventoryProducts();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Save Cart to LocalStorage whenever cart changes
  const loadUserCart = (userId?: string) => {
    try {
      const storageKey = `flashcart_cart_${userId || 'guest'}`;
      const savedCart = localStorage.getItem(storageKey);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      } else {
        setCart([]);
      }
    } catch {
      setCart([]);
    }
  };

  const saveUserCart = (newCart: CartItem[], userId?: string) => {
    setCart(newCart);
    try {
      const storageKey = `flashcart_cart_${userId || session?.user?.id || 'guest'}`;
      localStorage.setItem(storageKey, JSON.stringify(newCart));
    } catch {
      // LocalStorage fallback
    }
  };

  // Fetch all items from inventory and products separately to prevent schema relationship errors
  const fetchInventoryProducts = async () => {
    setLoading(true);
    try {
      const [invResult, prodResult] = await Promise.all([
        supabase.from('inventory').select('inventory_id, stock_quantity, expiry_date, product_id'),
        supabase.from('products').select('product_id, product_name, category, unit_price'),
      ]);

      const inventory = invResult.data ?? [];
      const productsList = prodResult.data ?? [];

      const productMap: Record<number, any> = {};
      for (const p of productsList) {
        productMap[p.product_id] = p;
      }

      // Merge inventory with product details
      let items: ProductItem[] = inventory.map(inv => {
        const prod = productMap[inv.product_id] ?? {};
        return {
          product_id:   inv.product_id,
          product_name: prod.product_name ?? `Product #${inv.product_id}`,
          category:     prod.category     ?? 'General',
          unit_price:   parseFloat(prod.unit_price) || 0,
          stock:        inv.stock_quantity ?? 0,
          expiry:       inv.expiry_date   ?? 'N/A',
        };
      });

      // Fallback: If inventory table has no items, display items from products table
      if (items.length === 0 && productsList.length > 0) {
        items = productsList.map(p => ({
          product_id:   p.product_id,
          product_name: p.product_name,
          category:     p.category ?? 'General',
          unit_price:   parseFloat(p.unit_price) || 0,
          stock:        0,
          expiry:       'N/A',
        }));
      }

      setProducts(items);
    } catch (err: any) {
      console.error('Error fetching inventory products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper checks
  const isItemExpired = (expiryStr: string) => {
    if (!expiryStr || expiryStr === 'N/A') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(expiryStr) < today;
  };

  // ── Cart Operations & Oversell Protection ──
  const handleAddToCart = (product: ProductItem) => {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }

    if (isItemExpired(product.expiry)) {
      showToast(`"${product.product_name}" is expired and cannot be purchased.`, 'error');
      return;
    }

    if (product.stock <= 0) {
      showToast(`Sorry! "${product.product_name}" is currently Sold Out.`, 'error');
      return;
    }

    const existingIndex = cart.findIndex(item => item.product_id === product.product_id);

    if (existingIndex > -1) {
      const currentQtyInCart = cart[existingIndex].cartQuantity;
      // Flash sale oversell limit: cannot exceed warehouse stock
      if (currentQtyInCart >= product.stock) {
        showToast(
          `Flash Sale Limit: Only ${product.stock} units of "${product.product_name}" available in warehouse!`,
          'info'
        );
        return;
      }

      const updatedCart = [...cart];
      updatedCart[existingIndex].cartQuantity += 1;
      saveUserCart(updatedCart);
      showToast(`Added another "${product.product_name}" to your cart!`, 'success');
    } else {
      const newCartItem: CartItem = { ...product, cartQuantity: 1 };
      const updatedCart = [...cart, newCartItem];
      saveUserCart(updatedCart);
      showToast(`"${product.product_name}" added to cart!`, 'success');
    }
  };

  const handleUpdateCartQty = (productId: number, delta: number) => {
    const item = cart.find(c => c.product_id === productId);
    if (!item) return;

    const newQty = item.cartQuantity + delta;

    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    // Flash sale rule: cannot buy more than available in inventory
    if (newQty > item.stock) {
      showToast(
        `Flash Sale Limit Reached: Only ${item.stock} ${item.stock === 1 ? 'unit' : 'units'} left in warehouse!`,
        'info'
      );
      return;
    }

    const updated = cart.map(c => c.product_id === productId ? { ...c, cartQuantity: newQty } : c);
    saveUserCart(updated);
  };

  const handleRemoveFromCart = (productId: number) => {
    const updated = cart.filter(c => c.product_id !== productId);
    saveUserCart(updated);
    showToast('Item removed from cart.', 'info');
  };

  const handleClearCart = () => {
    saveUserCart([]);
  };

  // ── Step 1 of Checkout: Initiate Checkout (triggers Pincode Prompt) ──
  const handleInitiateCartCheckout = () => {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }

    if (cart.length === 0) {
      showToast('Your cart is empty.', 'error');
      return;
    }

    // Pre-check cart items against stock
    for (const item of cart) {
      if (item.cartQuantity > item.stock) {
        showToast(
          `Cannot proceed: "${item.product_name}" only has ${item.stock} units in warehouse!`,
          'error'
        );
        return;
      }
    }

    setPendingCheckoutItem(null); // Whole cart
    setIsCartOpen(false);
    setPincodeError('');
    setIsPincodeModalOpen(true);
  };

  const handleInitiateDirectBuy = (product: ProductItem) => {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }

    if (isItemExpired(product.expiry)) {
      showToast('This product is expired and cannot be purchased.', 'error');
      return;
    }

    if (product.stock <= 0) {
      showToast('This item is currently Out of Stock!', 'error');
      return;
    }

    setPendingCheckoutItem(product);
    setPincodeError('');
    setIsPincodeModalOpen(true);
  };

  // ── Step 2 of Checkout: Confirm Pincode & Execute Order ──
  const handleConfirmPincodeAndBuy = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPin = shippingPincode.trim();
    if (!cleanPin) {
      setPincodeError('Please enter your shipping delivery pincode.');
      return;
    }

    if (cleanPin.length < 3) {
      setPincodeError('Please enter a valid postal pincode.');
      return;
    }

    // Cache the pincode for future checkouts
    try {
      localStorage.setItem('flashcart_pincode', cleanPin);
    } catch {}

    setIsCheckingOut(true);
    setPincodeError('');

    // Prepare items array
    let itemsToBuy = [];
    if (pendingCheckoutItem) {
      itemsToBuy = [{
        product_id:   pendingCheckoutItem.product_id,
        quantity:     1,
        unit_price:   pendingCheckoutItem.unit_price,
        product_name: pendingCheckoutItem.product_name,
      }];
    } else {
      itemsToBuy = cart.map(item => ({
        product_id:   item.product_id,
        quantity:     item.cartQuantity,
        unit_price:   item.unit_price,
        product_name: item.product_name,
      }));
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id:      session.user.id,
          shipping_pincode: cleanPin,
          items:            itemsToBuy,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message || 'Purchase successful! Stock reserved.', 'success');

        // Close pincode modal
        setIsPincodeModalOpen(false);

        // If it was a cart checkout, clear cart
        if (!pendingCheckoutItem) {
          handleClearCart();
        }

        // Set receipt and open printable receipt modal!
        if (data.receipt) {
          setReceiptData({
            ...data.receipt,
            customer_email: session.user.email,
          });
          setIsReceiptModalOpen(true);
        }

        // Refresh live warehouse stock
        await fetchInventoryProducts();
      } else {
        setPincodeError(data.message || 'Checkout failed. Please check stock limits.');
        await fetchInventoryProducts();
      }
    } catch (err: any) {
      setPincodeError(err.message || 'Network error processing checkout.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ── Authentication Handlers ──
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMsg('');

    try {
      const { data, error } = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        : await supabase.auth.signUp({ email: authEmail, password: authPassword });

      if (error) {
        setAuthMsg(error.message);
      } else {
        setAuthMsg('');
        setIsAuthModalOpen(false);
        showToast(authMode === 'login' ? 'Welcome back!' : 'Account created! Welcome to FlashCart.', 'success');
      }
    } catch (err: any) {
      setAuthMsg(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCart([]);
    showToast('Signed out successfully.', 'info');
  };

  // Totals
  const totalCartItems = cart.reduce((sum, item) => sum + item.cartQuantity, 0);
  const cartSubtotal   = cart.reduce((sum, item) => sum + item.unit_price * item.cartQuantity, 0);

  // Categories list
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  // Filtered products list
  const displayedProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch   = searchQuery.trim() === '' ||
      p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-500 selection:text-white">

      {/* Top Banner (Hidden in print) */}
      <div className="no-print bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white text-xs py-2 px-4 text-center font-bold tracking-wide flex items-center justify-center gap-2 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
        <span>⚡ LIVE FLASH SALE — Real-time Stock Sync & Instant Direct Purchase</span>
      </div>

      {/* Main Navbar (Hidden in print) */}
      <nav className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">

          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
              ⚡
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              Flash<span className="text-blue-600">Cart</span>
            </span>
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search products or categories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-full pl-9 pr-4 py-2 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* Admin Command Center Link */}
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3 py-2 rounded-lg border border-slate-200 transition-colors"
            >
              <span>Command Center</span>
              <span className="text-[10px] text-blue-600">↗</span>
            </Link>

            {/* User Session */}
            {session ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                    {session.user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400">Customer</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-xs font-bold text-slate-500 hover:text-red-600 px-2 py-1 transition-colors"
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}
                className="text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Sign In
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="text-base">🛒</span>
              <span className="hidden sm:inline text-xs uppercase tracking-wider font-extrabold">Cart</span>
              <span className="bg-white text-blue-600 text-xs font-black px-2 py-0.5 rounded-full ml-0.5">
                {totalCartItems}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-full pl-9 pr-4 py-2 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>
      </nav>

      {/* Hero Showcase (Hidden in print) */}
      <section className="no-print bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/80 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-3">
                <span>🔥</span> Guaranteed Oversell Protection
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                High-Speed Warehouse <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Flash Sale Storefront
                </span>
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
                Direct-from-warehouse inventory. Real-time stock reservation ensures you never buy items beyond live warehouse quantities.
              </p>
            </div>

            {/* Live Stats Pill */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-6 divide-x divide-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catalog Items</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{products.length}</p>
              </div>
              <div className="pl-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Stock</p>
                <p className="text-2xl font-black text-blue-600 mt-0.5">
                  {products.reduce((acc, curr) => acc + curr.stock, 0)} <span className="text-xs font-bold text-slate-500">units</span>
                </p>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs sm:text-sm font-bold px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid (Hidden in print) */}
      <main className="no-print max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold text-sm mt-3 animate-pulse">Syncing warehouse catalog...</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto my-12">
            <span className="text-4xl">📦</span>
            <h3 className="text-lg font-bold text-slate-900 mt-3">No products found</h3>
            <p className="text-slate-500 text-xs mt-1">
              Try adjusting your search query or switching category filters.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="mt-4 bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedProducts.map((product) => {
              const expired = isItemExpired(product.expiry);
              const isSoldOut = product.stock <= 0;
              const cartItem = cart.find(c => c.product_id === product.product_id);
              const qtyInCart = cartItem ? cartItem.cartQuantity : 0;

              return (
                <div
                  key={product.product_id}
                  className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-lg ${
                    expired
                      ? 'border-red-200 bg-red-50/20'
                      : isSoldOut
                      ? 'border-slate-200 opacity-75'
                      : 'border-slate-200 hover:border-blue-400'
                  }`}
                >
                  {/* Card Header & Badges */}
                  <div className="p-5 pb-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider truncate max-w-[120px]">
                        {product.category}
                      </span>

                      {/* Stock Status Badge */}
                      {expired ? (
                        <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          ⚠️ Expired
                        </span>
                      ) : isSoldOut ? (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          Sold Out
                        </span>
                      ) : product.stock <= 10 ? (
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
                          ⚡ Only {product.stock} Left!
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          In Stock ({product.stock})
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                      {product.product_name}
                    </h3>

                    {/* Expiry date tag */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                      <span>Expires:</span>
                      <span className={`font-mono ${expired ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                        {product.expiry || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Price & Actions */}
                  <div className="p-5 pt-4 mt-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <span className="text-xs text-slate-400 font-medium">Price</span>
                        <p className="text-2xl font-black text-slate-900 tracking-tight">
                          ${product.unit_price.toFixed(2)}
                        </p>
                      </div>

                      {qtyInCart > 0 && (
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                          {qtyInCart} in cart
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={isSoldOut || expired || qtyInCart >= product.stock}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSoldOut || expired
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : qtyInCart >= product.stock
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 hover:border-slate-400 shadow-sm active:scale-95'
                        }`}
                        title={qtyInCart >= product.stock ? 'Max warehouse stock in cart' : 'Add to Cart'}
                      >
                        <span>🛒</span>
                        <span>{qtyInCart >= product.stock ? 'Max Added' : '+ Cart'}</span>
                      </button>

                      <button
                        onClick={() => handleInitiateDirectBuy(product)}
                        disabled={isSoldOut || expired || isCheckingOut}
                        className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center cursor-pointer ${
                          isSoldOut || expired
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 hover:shadow-lg active:scale-95'
                        }`}
                      >
                        {isSoldOut ? 'Sold Out' : expired ? 'Expired' : 'Buy Now'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Slide-out Cart Drawer (Hidden in print) */}
      {isCartOpen && (
        <div className="no-print fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">

              {/* Drawer Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-lg shadow-md">
                    🛒
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Your Flash Cart</h2>
                    <p className="text-xs text-slate-400">
                      {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'} reserved for checkout
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-slate-400 hover:text-white text-xl p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-6 divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                    <span className="text-5xl mb-3">🛍️</span>
                    <h3 className="text-base font-bold text-slate-800">Your cart is empty</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Explore our live flash sale items and add items to your cart before stock runs out!
                    </p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="mt-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/30 cursor-pointer"
                    >
                      Shop Flash Sales
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product_id} className="py-4 flex gap-4 items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {item.product_name}
                          </h4>
                          <button
                            onClick={() => handleRemoveFromCart(item.product_id)}
                            className="text-slate-400 hover:text-red-600 text-xs p-1 cursor-pointer"
                            title="Remove item"
                          >
                            🗑️
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          ${item.unit_price.toFixed(2)} each &bull; <span className="font-semibold text-slate-700">{item.stock} left in stock</span>
                        </div>

                        {/* Quantity Stepper & Subtotal */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-1 bg-slate-50">
                            <button
                              onClick={() => handleUpdateCartQty(item.product_id, -1)}
                              className="w-6 h-6 rounded bg-white hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center shadow-xs cursor-pointer"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="text-xs font-black text-slate-900 px-2 min-w-[20px] text-center">
                              {item.cartQuantity}
                            </span>
                            <button
                              onClick={() => handleUpdateCartQty(item.product_id, 1)}
                              disabled={item.cartQuantity >= item.stock}
                              className="w-6 h-6 rounded bg-white hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center shadow-xs disabled:opacity-30 cursor-pointer"
                              title={item.cartQuantity >= item.stock ? 'Maximum warehouse stock reached' : 'Increase quantity'}
                            >
                              +
                            </button>
                          </div>

                          <div className="text-sm font-black text-slate-900">
                            ${(item.unit_price * item.cartQuantity).toFixed(2)}
                          </div>
                        </div>

                        {/* Oversell Protection Warning inside Cart */}
                        {item.cartQuantity >= item.stock && (
                          <p className="text-[10px] font-bold text-amber-700 bg-amber-50 rounded px-2 py-0.5 mt-2 inline-block">
                            ⚠️ Maximum stock limit reached ({item.stock} units available)
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Drawer Footer */}
              {cart.length > 0 && (
                <div className="p-6 bg-slate-50 border-t border-slate-200">
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>Items Subtotal ({totalCartItems})</span>
                      <span className="font-semibold text-slate-800">${cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>Instant Flash Shipping</span>
                      <span className="text-green-600 font-bold uppercase text-[11px]">Free</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900">
                      <span>Total Amount</span>
                      <span className="text-blue-600 text-xl">${cartSubtotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleInitiateCartCheckout}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>⚡ BUY NOW (Instant Direct Checkout)</span>
                  </button>

                  <p className="text-center text-[11px] text-slate-400 mt-2 font-medium">
                    Direct buy enabled &bull; No payment gateway required &bull; Live inventory deduction
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Delivery Pincode Prompt Modal ── */}
      {isPincodeModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !isCheckingOut && setIsPincodeModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 z-10 border border-slate-200">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">
                  📍
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Shipping Delivery Pincode</h3>
                  <p className="text-xs text-slate-500">Required for warehouse delivery & customer record</p>
                </div>
              </div>

              {!isCheckingOut && (
                <button
                  onClick={() => setIsPincodeModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xl p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Order Preview Box */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 mb-5 text-xs text-slate-700">
              <p className="font-bold text-slate-900 mb-1">
                {pendingCheckoutItem ? 'Direct Item Purchase:' : `Cart Checkout (${totalCartItems} items):`}
              </p>
              <div className="flex justify-between items-center text-slate-600">
                <span className="truncate max-w-[240px]">
                  {pendingCheckoutItem ? pendingCheckoutItem.product_name : cart.map(c => c.product_name).join(', ')}
                </span>
                <span className="font-black text-slate-900 text-sm">
                  ${pendingCheckoutItem ? pendingCheckoutItem.unit_price.toFixed(2) : cartSubtotal.toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmPincodeAndBuy} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Shipping Pincode / Postal Code <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  autoFocus
                  type="text"
                  maxLength={10}
                  value={shippingPincode}
                  onChange={e => { setShippingPincode(e.target.value); setPincodeError(''); }}
                  placeholder="e.g. 560001, 110001"
                  className="w-full border-2 border-slate-300 focus:border-blue-500 p-3.5 rounded-xl outline-none font-mono text-base font-bold text-slate-900 transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This will be saved to your customer record and printed on your official receipt.
                </p>
              </div>

              {pincodeError && (
                <div className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                  {pincodeError}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  disabled={isCheckingOut}
                  onClick={() => setIsPincodeModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCheckingOut || !shippingPincode.trim()}
                  className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCheckingOut ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Reserving Stock...</span>
                    </>
                  ) : (
                    <span>⚡ Confirm & Buy Now</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Printable Order Receipt Modal ── */}
      {isReceiptModalOpen && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 printable-receipt-modal overflow-y-auto">
          {/* Backdrop (hidden in print) */}
          <div
            onClick={() => setIsReceiptModalOpen(false)}
            className="no-print absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 z-10 border border-slate-200 printable-receipt-content my-8">

            {/* Receipt Brand & Header */}
            <div className="border-b border-slate-200 pb-5 mb-5 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-2xl shadow-md mb-2">
                ⚡
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Flash<span className="text-blue-600">Cart</span>
              </h2>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
                Official Purchase Receipt
              </p>
            </div>

            {/* Receipt Meta Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80 mb-5">
              <div>
                <span className="text-slate-400 block font-medium">Receipt No.</span>
                <span className="font-mono font-bold text-slate-900">{receiptData.receiptNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Order Date</span>
                <span className="font-semibold text-slate-900">
                  {new Date(receiptData.orderDate).toLocaleDateString()} {new Date(receiptData.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Customer Email</span>
                <span className="font-semibold text-slate-900 truncate block">
                  {session?.user?.email || 'Customer'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Delivery Pincode</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded inline-block">
                  📍 {receiptData.shipping_pincode}
                </span>
              </div>
            </div>

            {/* Purchased Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold">
                    <th className="p-3">Item Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiptData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">{item.product_name}</td>
                      <td className="p-3 text-center font-bold text-slate-700">{item.quantity}</td>
                      <td className="p-3 text-right text-slate-600">${item.unit_price.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 text-xs border-t border-slate-200 pt-4 mb-5">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-slate-800">${receiptData.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping & Fulfillment:</span>
                <span className="text-green-600 font-bold uppercase">Free (Flash Dispatch)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Payment Method:</span>
                <span className="font-semibold text-slate-800">Direct Checkout (Paid)</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900">
                <span>Grand Total Paid:</span>
                <span className="text-blue-600 text-lg">${receiptData.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Warehouse Verification Badge */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-xs text-green-800 font-semibold mb-6 flex items-center justify-center gap-2">
              <span>✅</span>
              <span>Warehouse Stock Reserved & Shipping Pincode Recorded</span>
            </div>

            {/* Receipt Modal Buttons (Hidden in print) */}
            <div className="no-print flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer hover:scale-[1.01]"
              >
                <span>🖨️</span>
                <span>Print / Save as PDF</span>
              </button>

              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3.5 rounded-xl transition-all text-xs cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Auth Modal (Sign In / Sign Up) (Hidden in print) */}
      {isAuthModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsAuthModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 z-10 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <h3 className="text-xl font-black text-slate-900">
                  {authMode === 'login' ? 'Customer Sign In' : 'Create Customer Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Toggle Mode */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthMsg(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setAuthMsg(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  authMode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={authPassword}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>

              {authMsg && (
                <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                  {authMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-md shadow-blue-600/30 transition-all text-sm disabled:opacity-50 cursor-pointer"
              >
                {authLoading ? 'Verifying...' : authMode === 'login' ? 'Sign In & Continue' : 'Create Free Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Banner (Hidden in print) */}
      {toast && (
        <div className="no-print fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-5 py-3.5 rounded-xl shadow-xl font-bold text-sm flex items-center gap-3 border ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : toast.type === 'error'
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-amber-500 text-slate-900 border-amber-400'
            }`}
          >
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚡'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Footer (Hidden in print) */}
      <footer className="no-print bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>FlashCart &bull; Real-time Flash Sale Engine & Warehouse Inventory Protection</p>
        <p className="mt-1.5 font-bold text-slate-700">Educational project for Sardar Patel Institute of Technology</p>
      </footer>
    </div>
  );
}
