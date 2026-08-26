# Step 6 — Flutter Project Scaffold

Created `jasmin_dashboard/` as the Flutter admin app source scaffold.

## Included

- `pubspec.yaml` dependencies: Dio, Riverpod, Secure Storage, GoRouter, Google Fonts, intl.
- `lib/main.dart` and `lib/app.dart`.
- Central API config via `--dart-define=JASMIN_API_BASE_URL=...`.
- Dio API client with Bearer token injection.
- Secure token storage.
- Pink/purple app theme.
- GoRouter route structure.
- Base auth provider/repository/API classes.
- Placeholder dashboard/admin feature screens.

## Not included yet

- Full login UI polish and validation.
- Full Google Authenticator 2FA UX.
- Dashboard stats API integration UI.
- Orders/products/games management UI.

Those are handled in Step 7+.
