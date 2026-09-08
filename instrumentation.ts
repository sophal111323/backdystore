export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const nodeCrypto = await import('node:crypto');
      if (nodeCrypto?.webcrypto) {
        if (!globalThis.crypto) {
          (globalThis as any).crypto = nodeCrypto.webcrypto;
        } else if (!globalThis.crypto.subtle) {
          try {
            Object.defineProperty(globalThis.crypto, "subtle", {
              value: nodeCrypto.webcrypto.subtle,
              writable: true,
              configurable: true,
            });
          } catch {
            (globalThis.crypto as any).subtle = nodeCrypto.webcrypto.subtle;
          }
        }
      }
    } catch (e) {
      console.warn('[instrumentation] webcrypto init warning:', e);
    }
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      await import('@/lib/telegramBotService');
    } catch (err) {
      console.warn('[instrumentation] Failed to initialize telegramBotService:', err);
    }

    try {
      const { startPendingOrdersSyncWorker } = await import('@/lib/paymentSyncService');
      startPendingOrdersSyncWorker();
    } catch (err) {
      console.warn('[instrumentation] Failed to initialize paymentSyncService:', err);
    }
  }
}
