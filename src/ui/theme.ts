export const theme = {
  color: {
    background: "#344532",
    backgroundTexture: "grain",
    primaryText: "#f5f1e8",
    secondaryText: "#9aaa92",
    accentFire: "#ff4d00",
    accentEmber: "#cc3d00",
    accentGrowth: "#5a9e78",
    accentLiving: "#8abf96",
    accentMature: "#7aaa82",
    cardOverlay: "rgba(247, 243, 235, 0.06)",
  },

  stage: {
    seed: { color: "#5a9e78", label: "Seed" },
    sprout: { color: "#8abf96", label: "Sprout" },
    mature: { color: "#7aaa82", label: "Mature" },
    ember: { color: "#ff4d00", label: "Ember" },
  },

  font: {
    scripture: "'Crimson Pro', 'Georgia', serif",
    ui: "Inter, system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', monospace",
  },

  size: {
    scriptureDisplay: "22px",
    heading: "18px",
    body: "15px",
    caption: "12px",
    metadata: "11px",
  },

  radius: {
    card: "12px",
    button: "8px",
    input: "6px",
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px",
  },

  animation: {
    entrance: "300ms ease-out",
    transition: "200ms ease-in-out",
    spark: "150ms ease-out",
  },
} as const;

export type Theme = typeof theme;
