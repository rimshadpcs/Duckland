const LEFT_PANEL_WIDTH_KEY = "feynduck:leftPanelWidth";
const RIGHT_PANEL_WIDTH_KEY = "feynduck:rightPanelWidth";

type PanelSide = "left" | "right";

const PANEL_CONFIG = {
  left: {
    key: LEFT_PANEL_WIDTH_KEY,
    defaultWidth: 300,
    minWidth: 220,
    maxWidth: 420,
  },
  right: {
    key: RIGHT_PANEL_WIDTH_KEY,
    defaultWidth: 360,
    minWidth: 280,
    maxWidth: 480,
  },
} satisfies Record<
  PanelSide,
  { key: string; defaultWidth: number; minWidth: number; maxWidth: number }
>;

function warnStorage(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[panelStorage] ${message}`);
  }
}

export function clampPanelWidth(side: PanelSide, width: number) {
  const { minWidth, maxWidth } = PANEL_CONFIG[side];
  return Math.min(Math.max(width, minWidth), maxWidth);
}

export function getPanelWidth(side: PanelSide) {
  const config = PANEL_CONFIG[side];
  const raw = window.localStorage.getItem(config.key);

  if (!raw) return config.defaultWidth;

  const width = Number(raw);

  if (!Number.isFinite(width)) {
    warnStorage(`Invalid ${side} panel width in localStorage.`);
    return config.defaultWidth;
  }

  return clampPanelWidth(side, width);
}

export function savePanelWidth(side: PanelSide, width: number) {
  window.localStorage.setItem(
    PANEL_CONFIG[side].key,
    clampPanelWidth(side, width).toString(),
  );
}
