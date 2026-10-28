import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import pool from '@/lib/db';

export async function POST(request) {
  try {
    const { inventory_id, product_id, stock_quantity } = await request.json();
    const qty = parseInt(stock_quantity, 10);

    if (isNaN(qty) || qty < 0) {
      return NextResponse.json({ success: false, message: 'Invalid stock quantity' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let query = supabaseAdmin.from('inventory').update({ stock_quantity: qty });
    if (inventory_id) {
      query = query.eq('inventory_id', inventory_id);
    } else if (product_id) {
      query = query.eq('product_id', product_id);
    } else {
      return NextResponse.json({ success: false, message: 'inventory_id or product_id required' }, { status: 400 });
    }

    const { error } = await query;
    if (error) {
      // Fallback to pool query
      try {
        if (inventory_id) {
          await pool.query(
            `UPDATE Inventory SET stock_quantity = $1, status = CASE WHEN $1 = 0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END WHERE inventory_id = $2`,
            [qty, inventory_id]
          );
        } else if (product_id) {
          await pool.query(
            `UPDATE Inventory SET stock_quantity = $1, status = CASE WHEN $1 = 0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END WHERE product_id = $2`,
            [qty, product_id]
          );
        }
      } catch (poolErr) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: `Stock updated to ${qty}`, stock_quantity: qty });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
