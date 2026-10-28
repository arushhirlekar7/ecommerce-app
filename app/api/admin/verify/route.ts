import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/verify
 * Checks if the bearer token belongs to an admin.
 * Uses the service role key to bypass RLS on the customers table.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ isAdmin: false, error: 'No token' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Verify the token and get the user
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ isAdmin: false, error: 'Invalid token' }, { status: 401 });
  }

  // 2. Read role from customers table
  const { data, error: roleErr } = await supabaseAdmin
    .from('customers')
    .select('role')
    .eq('customer_id', user.id)
    .single();

  let isAdmin = data?.role === 'admin';

  // 3. Fallback: check user metadata
  if (!isAdmin && user.user_metadata?.role === 'admin') {
    isAdmin = true;
    // Auto-sync into customers table
    await supabaseAdmin.from('customers').upsert(
      { customer_id: user.id, role: 'admin', email: user.email },
      { onConflict: 'customer_id' }
    );
  }

  if (!isAdmin) {
    return NextResponse.json({ isAdmin: false, userId: user.id, role: data?.role ?? null });
  }

  return NextResponse.json({ isAdmin: true, email: user.email });
}
