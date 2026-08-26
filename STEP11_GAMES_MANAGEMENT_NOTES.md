# Step 11 — Games Management

This step builds the Flutter `JASMIN_DASHBOARD` Games Management feature.

## Scope completed

- Games list connected to `GET /api/admin/games`
- Search by name, slug, publisher/category label, currency, UID label, and description
- Filter by visibility and featured status
- Create game using `POST /api/admin/games`
- Edit game using `GET/PATCH /api/admin/games/:id`
- Enable/disable game from the list
- Safe delete using `DELETE /api/admin/games/:id`
- Reorder games using `POST /api/admin/games/reorder`
- Pull-to-refresh, manual refresh, and 30-second auto-refresh
- Mobile/tablet friendly forms and cards

## Notes

The current database has `publisher`, but it does not have a dedicated `category` column. The Flutter editor labels this field as `Publisher / category label` to avoid changing backend schema in this step.

## Test

```bash
cd jasmin_dashboard
flutter pub get
flutter analyze
flutter run --dart-define=JASMIN_API_BASE_URL=http://10.0.2.2:3000
```

After login and 2FA, open Games and test create/edit/hide/reorder/delete.
