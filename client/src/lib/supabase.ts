import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let ready: Promise<SupabaseClient>;

ready = (async () => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseAnonKey) {
        client = createClient(data.supabaseUrl, data.supabaseAnonKey);
        return client;
      }
    }
  } catch {}
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (url && key) {
    client = createClient(url, key);
  } else {
    console.warn('Supabase URL or Anon Key not set. Auth will not work.');
    client = createClient('https://placeholder.supabase.co', 'placeholder');
  }
  return client;
})();

export { ready };
export async function getClient() {
  return ready;
}
