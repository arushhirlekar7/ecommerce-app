import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/first-setup
 *
 * Two modes:
 *  1. No setupKey  → only works when zero admins exist (first-time)
 *  2. setupKey === ADMIN_SETUP_KEY → force-grants admin regardless (developer override)
 */
export async function POST(req: Request) {
  const { userId, email, setupKey } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: 'No user ID provided.' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const forceOverride = setupKey && setupKey === process.env.ADMIN_SETUP_KEY;

  if (!forceOverride) {
    // Safety check: only allow if no admins exist yet
    const { data: existingAdmins, error: checkErr } = await supabaseAdmin
      .from('customers')
      .select('customer_id')
      .eq('role', 'admin');

    if (checkErr) {
      return NextResponse.json({ error: checkErr.message }, { status: 500 });
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json(
        { error: 'An admin already exists. Use the Setup Key override to force-grant access.' },
        { status: 403 }
      );
    }
  }

  // Try upsert first (handles both insert + update)
  const { error: upsertErr } = await supabaseAdmin
    .from('customers')
    .upsert(
      { customer_id: userId, role: 'admin', email: email ?? '' },
      { onConflict: 'customer_id' }
    );

  if (upsertErr) {
    // Fallback: try plain update
    const { error: updateErr } = await supabaseAdmin
      .from('customers')
      .update({ role: 'admin' })
      .eq('customer_id', userId);

    if (updateErr) {
      // Last resort: plain insert
      const { error: insertErr } = await supabaseAdmin
        .from('customers')
        .insert({ customer_id: userId, role: 'admin' });

      if (insertErr) {
        return NextResponse.json(
          { error: `Could not set admin role: ${insertErr.message}` },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
