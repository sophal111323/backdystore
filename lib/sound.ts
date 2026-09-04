/**
 * Utility to play audio notifications.
 * Safe for browser execution with autoplay policy handling.
 */
export function playPaymentSuccessSound() {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio("/sounds/payment.mp3");
    audio.preload = "auto";
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay could be blocked by browser policy if no interaction occurred yet
        console.info("Payment success audio autoplay info:", err);
      });
    }
  } catch (err) {
    console.warn("Could not play payment success sound:", err);
  }
}

