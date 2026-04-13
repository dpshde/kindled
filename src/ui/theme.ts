export const theme = {
  color: {
    background: "#fdfcf8",
    backgroundWarm: "#f5f2eb",
    primaryText: "#2d2a26",
    secondaryText: "#6b6359",
    tertiaryText: "#9a9185",
    accentFire: "#c46a1f",
    accentFireDim: "#a85a1a",
    accentEmber: "#d97a2e",
    accentGrowth: "#5a8a4e",
    accentGrowthDim: "#4a7a3e",
    accentLiving: "#6b9a5f",
    accentMature: "#4a6f3f",
    cardOverlay: "rgba(0, 0, 0, 0.04)",
  },

  stage: {
    seed: { color: "#7aad6e", label: "Seed" },
    sprout: { color: "#a3cf96", label: "Sprout" },
    mature: { color: "#8fb884", label: "Mature" },
    ember: { color: "#e8922f", label: "Ember" },
  },

  font: {
    scripture: "'Lora', 'Georgia', serif",
    ui: "'DM Sans', system-ui, sans-serif",
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
    card: "14px",
    button: "10px",
    input: "8px",
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
    entrance: "400ms cubic-bezier(0.16, 1, 0.3, 1)",
    transition: "200ms ease-in-out",
    spark: "150ms ease-out",
  },
} as const;

export type Theme = typeof theme;
