export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (typeof globalThis !== 'undefined' && (!globalThis.crypto || !globalThis.crypto.subtle)) {
      try {
        const nodeCrypto = await import('node:crypto');
        (globalThis as any).crypto = nodeCrypto.webcrypto;
      } catch (e) {
        console.warn('[instrumentation] webcrypto init warning:', e);
      }
    }
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
