type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

type PostHogLike = {
  capture: (eventName: string, properties?: AnalyticsProperties) => void;
};

export function trackEvent(eventName: string, properties?: AnalyticsProperties) {
  if (typeof window === "undefined") return;

  const maybePostHog = (window as Window & { posthog?: PostHogLike }).posthog;

  try {
    maybePostHog?.capture(eventName, properties);
  } catch {
    // Analytics should never block the product experience.
  }
}
