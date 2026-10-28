import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, password, role } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const assignedRole = role === 'admin' ? 'admin' : 'user';

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Create or update user in Supabase auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: assignedRole }
    });

    let userId = data?.user?.id;

    if (error) {
      // If user already exists in auth, update their password and role metadata
      if (error.message.includes('already exists') || error.message.includes('unique')) {
        const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
        const existing = usersList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          userId = existing.id;
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password,
            user_metadata: { role: assignedRole }
          });
        } else {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    // 2. Upsert customer role in customers table
    if (userId) {
      const { error: upsertErr } = await supabaseAdmin
        .from('customers')
        .upsert(
          { customer_id: userId, role: assignedRole, email },
          { onConflict: 'customer_id' }
        );

      if (upsertErr) {
        // Fallback update
        await supabaseAdmin
          .from('customers')
          .update({ role: assignedRole })
          .eq('customer_id', userId);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${assignedRole === 'admin' ? 'Admin Wizard' : 'User'} account for ${email} created successfully! They can now log in.`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'An error occurred' }, { status: 500 });
  }
}
