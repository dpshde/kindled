/**
 * Icon box sizes (px) — single scale for Phosphor wrappers and custom SVGs.
 * Keeps toolbars, CTAs, and inline actions visually aligned (normalize / polish).
 */
export const ICON_PX = {
  /** App chrome: back, close, header trash */
  header: 20,
  /** Stacked primary actions (e.g. Review later / Mastered) */
  actionPrimary: 20,
  /** Decision panel: Add reflection, Snooze (inline with ~13px label) */
  decisionPanel: 16,
  /** Mastered / Review later — keep modest vs 12px stacked label */
  decisionStack: 20,
  /** Inline controls: tertiary rows, inputs, list rows, small buttons */
  inline: 16,
  /** Dense lists: autocomplete rows, meta chips */
  compact: 14,
  /** Success / saved hero moment */
  emphasis: 24,
  /** Empty state mark */
  hero: 32,
  /** Quiet-close celebration */
  celebration: 40,
} as const;
