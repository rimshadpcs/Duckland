"use client";

import { useEffect } from "react";
import { trackEvent } from "@src/lib/analytics";

export function TrackEventOnMount({
  eventName,
  properties,
}: {
  eventName: string;
  properties?: Record<string, string>;
}) {
  useEffect(() => {
    trackEvent(eventName, properties);
  }, [eventName, properties]);

  return null;
}
