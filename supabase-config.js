/* Supabase connection for the shop menu and Milly's panel (/admin/).
   Fill in the Project URL and the publishable (anon) key from Supabase > Project Settings > API.
   The anon key is meant to be public; Row Level Security (supabase/setup.sql) decides what it can do.
   NEVER put the service_role key here. While empty, the site shows its built-in menu and checkout says it isn't switched on. */
window.MT_SUPABASE = { url: '', anonKey: '' };
