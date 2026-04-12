export const theme = {
  color: {
    background: "#1a2f23",
    backgroundTexture: "grain",
    primaryText: "#f7f5f0",
    secondaryText: "#a8b5a0",
    accentFire: "#e8a85d",
    accentEmber: "#c44b36",
    accentGrowth: "#7fb5a0",
    accentLiving: "#a4c2a5",
    accentMature: "#8fb894",
    cardOverlay: "rgba(247, 245, 240, 0.08)",
  },

  stage: {
    seed: { color: "#7fb5a0", label: "Seed" },
    sprout: { color: "#a4c2a5", label: "Sprout" },
    mature: { color: "#8fb894", label: "Mature" },
    ember: { color: "#e8a85d", label: "Ember" },
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
