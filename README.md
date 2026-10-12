# MT-THECREATOR site

Static site + two Vercel functions. Layout follows ken.didit; the brand, panel and checkout are Mili's own.

- `index.html`, `style.css`, `main.js`: storefront (menu, bag, Stripe checkout, motion with the footer toggle).
- `admin/`: Mili's Studio (orders, menu & prices, pickup days, shop settings). Sign-in by email link.
- `api/checkout.js`: prices the bag from the database and opens Stripe Checkout. `api/stripe-webhook.js`: marks orders paid.
- `supabase/setup.sql`: tables, Row Level Security, starting menu.
- Tests: `node test/checks.js` (order and price rules, webhook signature). `test/browser.js` needs playwright-core and Chrome.

## Go-live steps (Ty / Mili create the accounts; nothing here is live yet)
1. Supabase: create a project. In `supabase/setup.sql`, replace `OWNER@EMAIL.COM` with Mili's email, then run it in the SQL Editor.
   Under Authentication, add Mili as a user (email) and set the Site URL to the live domain + `/admin/`.
2. Put the Project URL and the **publishable/anon** key in `supabase-config.js`. Never use the service_role key there.
3. Stripe (Mili's account): copy the secret key. Add a webhook to `https://<domain>/api/stripe-webhook` for
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then copy its signing secret.
4. Vercel env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`.
5. If the domain isn't `mtthecreator.vercel.app`, update the og tags in `index.html`, `robots.txt` and `sitemap.xml`.
6. Test with Stripe test-mode keys first: place an order, pay with card 4242 4242 4242 4242, and check that it shows as Paid in the Studio.

Until steps 1 to 4 are done, the site shows its built-in menu and checkout honestly says online payment isn't switched on yet.
