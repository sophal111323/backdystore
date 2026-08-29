
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.GameScalarFieldEnum = {
  id: 'id',
  slug: 'slug',
  name: 'name',
  publisher: 'publisher',
  description: 'description',
  imageUrl: 'imageUrl',
  bannerUrl: 'bannerUrl',
  currencyName: 'currencyName',
  uidLabel: 'uidLabel',
  uidExample: 'uidExample',
  requiresServer: 'requiresServer',
  servers: 'servers',
  featured: 'featured',
  active: 'active',
  sortOrder: 'sortOrder',
  seoTitle: 'seoTitle',
  seoDescription: 'seoDescription',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  gameId: 'gameId',
  name: 'name',
  amount: 'amount',
  bonus: 'bonus',
  priceUsd: 'priceUsd',
  priceKhr: 'priceKhr',
  badge: 'badge',
  imageUrl: 'imageUrl',
  active: 'active',
  sortOrder: 'sortOrder',
  supplier: 'supplier',
  supplierCode: 'supplierCode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  orderNumber: 'orderNumber',
  gameId: 'gameId',
  productId: 'productId',
  playerUid: 'playerUid',
  serverId: 'serverId',
  playerNickname: 'playerNickname',
  customerEmail: 'customerEmail',
  customerPhone: 'customerPhone',
  amountUsd: 'amountUsd',
  amountKhr: 'amountKhr',
  currency: 'currency',
  paymentMethod: 'paymentMethod',
  paymentRef: 'paymentRef',
  paymentUrl: 'paymentUrl',
  qrString: 'qrString',
  paymentExpiresAt: 'paymentExpiresAt',
  status: 'status',
  deliveryNote: 'deliveryNote',
  failureReason: 'failureReason',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  topupProvider: 'topupProvider',
  topupProviderRef: 'topupProviderRef',
  topupStatus: 'topupStatus',
  supplierResponse: 'supplierResponse',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  paidAt: 'paidAt',
  deliveredAt: 'deliveredAt',
  promoCodeId: 'promoCodeId',
  discountUsd: 'discountUsd'
};

exports.Prisma.PromoCodeScalarFieldEnum = {
  id: 'id',
  code: 'code',
  discountType: 'discountType',
  discountValue: 'discountValue',
  minOrderUsd: 'minOrderUsd',
  maxUses: 'maxUses',
  usedCount: 'usedCount',
  expiresAt: 'expiresAt',
  active: 'active',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdminScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  name: 'name',
  role: 'role',
  active: 'active',
  createdAt: 'createdAt',
  lastLoginAt: 'lastLoginAt',
  totpSecret: 'totpSecret'
};

exports.Prisma.SettingsScalarFieldEnum = {
  id: 'id',
  telegramBotToken: 'telegramBotToken',
  telegramChatId: 'telegramChatId',
  updatedAt: 'updatedAt',
  siteName: 'siteName',
  exchangeRate: 'exchangeRate',
  supportTelegram: 'supportTelegram',
  supportTikTok: 'supportTikTok',
  supportEmail: 'supportEmail',
  maintenanceMode: 'maintenanceMode',
  maintenanceMessage: 'maintenanceMessage',
  announcementEnabled: 'announcementEnabled',
  announcement: 'announcement',
  announcementTone: 'announcementTone',
  appMinSupportedVersion: 'appMinSupportedVersion',
  appLatestVersion: 'appLatestVersion',
  appForceUpdate: 'appForceUpdate',
  appUpdateUrl: 'appUpdateUrl',
  ordersEnabled: 'ordersEnabled',
  paymentsEnabled: 'paymentsEnabled',
  promosEnabled: 'promosEnabled',
  logoUrl: 'logoUrl',
  logoText: 'logoText',
  logoTagline: 'logoTagline'
};

exports.Prisma.HeroBannerScalarFieldEnum = {
  id: 'id',
  title: 'title',
  subtitle: 'subtitle',
  imageUrl: 'imageUrl',
  linkUrl: 'linkUrl',
  ctaLabel: 'ctaLabel',
  active: 'active',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FaqScalarFieldEnum = {
  id: 'id',
  question: 'question',
  answer: 'answer',
  category: 'category',
  active: 'active',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BlogPostScalarFieldEnum = {
  id: 'id',
  slug: 'slug',
  title: 'title',
  excerpt: 'excerpt',
  content: 'content',
  coverUrl: 'coverUrl',
  tag: 'tag',
  published: 'published',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  adminId: 'adminId',
  adminEmail: 'adminEmail',
  action: 'action',
  targetType: 'targetType',
  targetId: 'targetId',
  details: 'details',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.BlockedIdentityScalarFieldEnum = {
  id: 'id',
  type: 'type',
  value: 'value',
  reason: 'reason',
  createdAt: 'createdAt'
};

exports.Prisma.AdminAuthLockScalarFieldEnum = {
  id: 'id',
  identifier: 'identifier',
  failCount: 'failCount',
  lockedUntil: 'lockedUntil',
  forever: 'forever',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdminLoginChallengeScalarFieldEnum = {
  id: 'id',
  adminId: 'adminId',
  expiresAt: 'expiresAt',
  attemptCount: 'attemptCount',
  usedAt: 'usedAt',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdminSessionScalarFieldEnum = {
  id: 'id',
  adminId: 'adminId',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt',
  lastUsedAt: 'lastUsedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  type: 'type',
  title: 'title',
  message: 'message',
  targetType: 'targetType',
  targetId: 'targetId',
  readAt: 'readAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.IpProfileScalarFieldEnum = {
  id: 'id',
  ip: 'ip',
  country: 'country',
  city: 'city',
  region: 'region',
  isp: 'isp',
  provider: 'provider',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RequestLogScalarFieldEnum = {
  id: 'id',
  ip: 'ip',
  method: 'method',
  path: 'path',
  statusCode: 'statusCode',
  country: 'country',
  isp: 'isp',
  provider: 'provider',
  device: 'device',
  os: 'os',
  browser: 'browser',
  userAgent: 'userAgent',
  referer: 'referer',
  blocked: 'blocked',
  isBot: 'isBot',
  riskScore: 'riskScore',
  createdAt: 'createdAt'
};

exports.Prisma.AdminLoginLogScalarFieldEnum = {
  id: 'id',
  adminEmail: 'adminEmail',
  ip: 'ip',
  country: 'country',
  isp: 'isp',
  provider: 'provider',
  device: 'device',
  os: 'os',
  browser: 'browser',
  userAgent: 'userAgent',
  success: 'success',
  message: 'message',
  createdAt: 'createdAt'
};

exports.Prisma.ProcessedWebhookEventScalarFieldEnum = {
  id: 'id',
  transactionId: 'transactionId',
  orderNumber: 'orderNumber',
  processedAt: 'processedAt'
};

exports.Prisma.RateLimitEntryScalarFieldEnum = {
  id: 'id',
  key: 'key',
  ip: 'ip',
  createdAt: 'createdAt'
};

exports.Prisma.UsedTotpTokenScalarFieldEnum = {
  id: 'id',
  adminId: 'adminId',
  token: 'token',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Game: 'Game',
  Product: 'Product',
  Order: 'Order',
  PromoCode: 'PromoCode',
  Admin: 'Admin',
  Settings: 'Settings',
  HeroBanner: 'HeroBanner',
  Faq: 'Faq',
  BlogPost: 'BlogPost',
  AuditLog: 'AuditLog',
  BlockedIdentity: 'BlockedIdentity',
  AdminAuthLock: 'AdminAuthLock',
  AdminLoginChallenge: 'AdminLoginChallenge',
  AdminSession: 'AdminSession',
  Notification: 'Notification',
  IpProfile: 'IpProfile',
  RequestLog: 'RequestLog',
  AdminLoginLog: 'AdminLoginLog',
  ProcessedWebhookEvent: 'ProcessedWebhookEvent',
  RateLimitEntry: 'RateLimitEntry',
  UsedTotpToken: 'UsedTotpToken'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
