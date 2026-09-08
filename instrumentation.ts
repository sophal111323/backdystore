export async function register() {
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
