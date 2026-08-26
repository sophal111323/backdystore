# Step 12 — Banners / Settings / FAQ

This step builds Flutter admin management screens for homepage banners, website settings, and FAQ content.

## Included

- Banners list, search, visibility filter, create, edit, hide/show, delete
- Settings editor for site name, exchange rate, support links, maintenance mode, announcement, branding, and Telegram notification fields
- FAQ list, search, category filter, visibility filter, create, edit, hide/show, delete
- Secure Bearer-token API integration using the auth flow from Step 7
- Pull-to-refresh and auto-refresh for banners and FAQ lists
- Website update confirmation messages after save actions

## Backend APIs used

- `GET /api/admin/banners`
- `POST /api/admin/banners`
- `GET /api/admin/banners/:id`
- `PATCH /api/admin/banners/:id`
- `DELETE /api/admin/banners/:id`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`
- `GET /api/admin/faqs`
- `POST /api/admin/faqs`
- `GET /api/admin/faqs/:id`
- `PATCH /api/admin/faqs/:id`
- `DELETE /api/admin/faqs/:id`

## Test

Run the backend and Flutter app, then log in with email/password and Google Authenticator 2FA. Test creating/editing banners, toggling maintenance mode, changing the announcement, and adding/editing FAQ entries. Public pages should refresh shortly because Step 5 added dynamic public data refresh.
