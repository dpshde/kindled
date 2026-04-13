export const theme = {
  color: {
    background: "#1a1714",
    backgroundWarm: "#1f1b16",
    primaryText: "#f0e6d6",
    secondaryText: "#a89b8a",
    tertiaryText: "#6b5f52",
    accentFire: "#e8922f",
    accentFireDim: "#c47a24",
    accentEmber: "#b5622a",
    accentGrowth: "#7aad6e",
    accentGrowthDim: "#5a8a4e",
    accentLiving: "#a3cf96",
    accentMature: "#8fb884",
    cardOverlay: "rgba(255, 240, 220, 0.04)",
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
