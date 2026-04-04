/**
 * Rotating 4-color palette for pads.
 * Assigned by padIndex % 4 — no two consecutive pads share the same color.
 */
export const PAD_COLORS = ['#E6D4B1', '#C46E1F', '#2F4F55', '#9C4F17']

export const getPadColor = (padIndex) => PAD_COLORS[padIndex % 4]

// Whether to use dark text when this color is the background (flash state)
const LIGHT_PAD_COLORS = new Set(['#E6D4B1'])
export const isLightPadColor = (color) => LIGHT_PAD_COLORS.has(color)
