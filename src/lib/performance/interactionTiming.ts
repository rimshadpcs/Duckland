export function startInteractionTiming(name: string) {
  if (process.env.NODE_ENV !== "development") {
    return () => {};
  }

  const startedAt = performance.now();
  console.debug("[interaction:start]", {
    name,
    startedAt: Math.round(startedAt),
  });

  return () => {
    const endedAt = performance.now();
    console.debug("[interaction:end]", {
      name,
      startedAt: Math.round(startedAt),
      endedAt: Math.round(endedAt),
      duration: Math.round(endedAt - startedAt),
    });
  };
}
