export const theme = {
  color: {
    background: "#1b2d24",
    backgroundTexture: "grain",
    primaryText: "#f5f1e8",
    secondaryText: "#a3b09a",
    accentFire: "#d4843a",
    accentEmber: "#bf5b3a",
    accentGrowth: "#6ea88f",
    accentLiving: "#9cbfa0",
    accentMature: "#87ad8c",
    cardOverlay: "rgba(247, 243, 235, 0.07)",
  },

  stage: {
    seed: { color: "#6ea88f", label: "Seed" },
    sprout: { color: "#9cbfa0", label: "Sprout" },
    mature: { color: "#87ad8c", label: "Mature" },
    ember: { color: "#d4843a", label: "Ember" },
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
