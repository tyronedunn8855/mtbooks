/* Supabase connection for the shop menu and Milly's panel (/admin/).
   Fill in the Project URL and the publishable (anon) key from Supabase > Project Settings > API.
   The anon key is meant to be public; Row Level Security (supabase/setup.sql) decides what it can do.
   NEVER put the service_role key here. While empty, the site shows its built-in menu and checkout says it isn't switched on. */
window.MT_SUPABASE = { url: 'https://vxcgptxeamutqofkqzaa.supabase.co', anonKey: 'sb_publishable_gGGzYR6W14vYHtK2FHqumQ_-2CyKc1K',
  // public half of the order-alert key pair; the private half lives only in Vercel (VAPID_PRIVATE_KEY)
  vapidKey: 'BIlmPxFChgupU1TyP3uXmDFm9TBlgsxygocXp7e7cmgZvDmmkH-ZKpQQEnkLIxpDz_XPUEPuP_eIovbF_9fkn3A' };
