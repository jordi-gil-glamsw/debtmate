// Supabase Edge Function (Deno): lets a signed-in user delete their own account.
// Deleting the auth user cascades to public.contacts and public.movements (on delete cascade).
// Deploy: Dashboard → Edge Functions → Deploy a new function → Via Editor (name: delete-account),
// or `npx supabase functions deploy delete-account`. Keep "Verify JWT" on (the default).
// The secret key is injected by Supabase at runtime; never ship it in the app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Current projects inject SUPABASE_SECRET_KEYS (JSON by key name); older ones SUPABASE_SERVICE_ROLE_KEY. */
function adminKey(): string | undefined {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      return parsed['default'] ?? Object.values(parsed)[0];
    } catch {
      // fall through to the legacy key
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  const key = adminKey();
  if (!key) return json({ error: 'server not configured' }, 500);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Ask the auth server who owns this access token: an API key or a forged token is rejected here.
  // Only that user can be deleted.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ deleted: true }, 200);
});
