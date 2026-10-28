import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { product_id, inventory_id, expiry_date } = await req.json();

    if (!expiry_date) {
      return NextResponse.json({ error: 'Expiry date is required' }, { status: 400 });
    }

    if (!product_id && !inventory_id) {
      return NextResponse.json({ error: 'product_id or inventory_id is required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabaseAdmin
      .from('inventory')
      .update({ expiry_date: expiry_date.trim() });

    if (inventory_id) {
      query = query.eq('inventory_id', inventory_id);
    } else {
      query = query.eq('product_id', product_id);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Expiry date updated successfully!',
      expiry_date: expiry_date.trim(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update expiry date' }, { status: 500 });
  }
}

