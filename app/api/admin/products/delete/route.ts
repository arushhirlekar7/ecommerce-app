import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { product_id } = await req.json();

    if (!product_id) {
      return NextResponse.json({ error: 'Missing product_id' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Delete from inventory first
    const { error: invErr } = await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('product_id', product_id);

    if (invErr) {
      console.error('Error deleting from inventory:', invErr);
    }

    // 2. Delete from order_items if existing
    try {
      await supabaseAdmin.from('order_items').delete().eq('product_id', product_id);
    } catch {
      // ignore if table doesn't exist or doesn't have product_id
    }

    // 3. Delete from products
    const { error: prodErr } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('product_id', product_id);

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Product deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete product' }, { status: 500 });
  }
}

