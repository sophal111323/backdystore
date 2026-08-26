# Step 14 — Auto Update

This step adds the final auto-update polish before testing.

## Added

- `RefreshIntervals` shared constants
- `PublicVersionApi` + repository + model
- `AppSyncController` global app sync state
- `AppSyncHost` lifecycle/resume handler
- Global sync icon in `AdminScaffold`
- Global notifications badge in `AdminScaffold`
- Audit log auto-refresh

## Refresh cadence

- Dashboard: 20 seconds
- Orders: 20 seconds
- Notifications: 20 seconds
- Products/Games/Banners/FAQ/Customers/Promo Codes: 30 seconds
- Audit Logs: 45 seconds
- Website public version: 15 seconds
- Resume refresh debounce: 2 seconds

## Backend endpoint used

- `GET /api/public/version`

The endpoint was added in Step 5. Flutter now uses it to confirm public website data versions change after admin updates.

## Safety

- Flutter still does not store any backend secrets.
- Sync checks use the existing Bearer token interceptor when needed.
- Public version checks expose only safe version strings, not private admin data.
- All writes still go through secure admin APIs with role checks and audit logs.
