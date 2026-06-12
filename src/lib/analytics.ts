export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (typeof window === "undefined") return;

  try {
    // @ts-ignore - posthog is injected via script tag
    window.posthog?.capture(eventName, properties);
  } catch (error) {
    // Analytics should never block the product experience.
    console.debug("Analytics failed silently:", error);
  }
}
