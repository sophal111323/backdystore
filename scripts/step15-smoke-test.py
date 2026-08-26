#!/usr/bin/env python3
"""Step 15 lightweight smoke checks for JASMINTOPUP + JASMIN_DASHBOARD.
This does not replace `npm run build` or `flutter analyze`; it verifies structure,
route coverage, Flutter imports, and security-sensitive wiring without needing DB access.
"""
from pathlib import Path
import re

flutter = Path('jasmin_dashboard/lib')
results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = '') -> None:
    results.append((name, passed, detail))


missing_imports: list[tuple[str, str]] = []
for file in flutter.rglob('*.dart'):
    text = file.read_text(errors='ignore')
    for match in re.finditer(r"import\s+['\"]([^'\"]+)['\"]", text):
        import_path = match.group(1)
        candidate: Path | None = None
        if import_path.startswith('package:jasmin_dashboard/'):
            candidate = Path('jasmin_dashboard/lib') / import_path.split('package:jasmin_dashboard/', 1)[1]
        elif import_path.startswith('../') or import_path.startswith('./'):
            candidate = (file.parent / import_path).resolve()
        if candidate is not None and not candidate.exists():
            missing_imports.append((str(file), import_path))
check('Flutter import paths exist', not missing_imports, f'{len(missing_imports)} missing imports')

for core_file in [
    'jasmin_dashboard/pubspec.yaml',
    'jasmin_dashboard/lib/main.dart',
    'jasmin_dashboard/lib/app.dart',
    'jasmin_dashboard/lib/core/network/api_client.dart',
    'jasmin_dashboard/lib/core/network/auth_interceptor.dart',
    'jasmin_dashboard/lib/core/storage/secure_token_storage.dart',
    'jasmin_dashboard/lib/core/routing/app_router.dart',
]:
    check(f'Core file exists: {core_file}', Path(core_file).exists())

required_routes = [
    'app/api/admin/auth/login/route.ts',
    'app/api/admin/auth/2fa/route.ts',
    'app/api/admin/auth/me/route.ts',
    'app/api/admin/auth/logout/route.ts',
    'app/api/admin/dashboard/route.ts',
    'app/api/admin/orders/route.ts',
    'app/api/admin/orders/[orderNumber]/route.ts',
    'app/api/admin/products/route.ts',
    'app/api/admin/products/[id]/route.ts',
    'app/api/admin/games/route.ts',
    'app/api/admin/games/[id]/route.ts',
    'app/api/admin/games/reorder/route.ts',
    'app/api/admin/banners/route.ts',
    'app/api/admin/banners/[id]/route.ts',
    'app/api/admin/settings/route.ts',
    'app/api/admin/faqs/route.ts',
    'app/api/admin/faqs/[id]/route.ts',
    'app/api/admin/promo-codes/route.ts',
    'app/api/admin/promo-codes/[id]/route.ts',
    'app/api/admin/customers/route.ts',
    'app/api/admin/customers/[key]/route.ts',
    'app/api/admin/audit-logs/route.ts',
    'app/api/admin/notifications/route.ts',
    'app/api/admin/notifications/[id]/route.ts',
    'app/api/public/version/route.ts',
]
missing_routes = [route for route in required_routes if not Path(route).exists()]
check('Required backend API route files exist', not missing_routes, ', '.join(missing_routes))

secret_patterns = [
    r'DATABASE_URL',
    r'JWT_SECRET',
    r'ADMIN_SESSION_SECRET',
    r'ENCRYPTION_KEY',
    r'API_KEY_PEPPER',
    r'KHPAY_API_KEY',
]
secret_hits: list[tuple[str, str]] = []
for file in Path('jasmin_dashboard').rglob('*'):
    if file.is_file() and file.suffix in {'.dart', '.yaml'}:
        text = file.read_text(errors='ignore')
        for pattern in secret_patterns:
            if re.search(pattern, text):
                secret_hits.append((str(file), pattern))
check('No backend secret names in Flutter Dart/YAML', not secret_hits, str(secret_hits[:10]))

interceptor = Path('jasmin_dashboard/lib/core/network/auth_interceptor.dart').read_text(errors='ignore')
check('Flutter Bearer token interceptor present', 'Authorization' in interceptor and 'Bearer' in interceptor)
check('Flutter 401 handling present', '401' in interceptor and ('clearToken' in interceptor or 'unauthorized' in interceptor.lower()))

router = Path('jasmin_dashboard/lib/core/routing/app_router.dart').read_text(errors='ignore')
for route in [
    '/login', '/two-factor', '/dashboard', '/orders', '/products', '/games',
    '/banners', '/settings', '/faqs', '/customers', '/promo-codes',
    '/audit-logs', '/notifications',
]:
    check(f'Flutter route {route} mapped', route in router)

schema = Path('prisma/schema.prisma').read_text(errors='ignore')
for model in [
    'AdminLoginChallenge', 'AdminSession', 'Notification', 'AuditLog', 'Game',
    'Product', 'Order', 'PromoCode', 'Faq', 'HeroBanner', 'Settings',
]:
    check(f'Prisma model {model} exists', f'model {model} ' in schema)

for suffix, base in [('.dart', Path('jasmin_dashboard/lib')), ('.ts', Path('lib')), ('.tsx', Path('app'))]:
    bad_files: list[str] = []
    for file in base.rglob(f'*{suffix}'):
        text = file.read_text(errors='ignore')
        for open_char, close_char in [('{', '}'), ('(', ')'), ('[', ']')]:
            if text.count(open_char) != text.count(close_char):
                bad_files.append(f'{file}: {open_char}{close_char} {text.count(open_char)}!={text.count(close_char)}')
                break
    check(f'Rough balanced delimiters for {suffix}', not bad_files, '; '.join(bad_files[:10]))

passed = sum(1 for _, ok, _ in results if ok)
for name, ok, detail in results:
    status = 'PASS' if ok else 'FAIL'
    suffix = f' | {detail}' if detail else ''
    print(f'{status} | {name}{suffix}')
print(f'SUMMARY | {passed}/{len(results)} passed')

if passed != len(results):
    raise SystemExit(1)
