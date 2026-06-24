// ---------------------------------------------------------------------------
// App theme — colors, spacing and radii.
// The brand accent is orange (#E65100). Import `colors` everywhere instead of
// hard-coding hex values so the look stays consistent.
// ---------------------------------------------------------------------------

export const colors = {
  // Brand accent (orange) + variants
  accent: '#E65100',
  accentDark: '#AC1900',
  accentLight: '#FF833A',
  accentSoft: '#FFF3E0', // very light orange, good for chip / badge backgrounds

  // Neutrals
  background: '#FFFFFF',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#ECECEC',
  divider: '#F2F2F2',

  // Text
  text: '#1A1A1A',
  textMuted: '#6B6B6B',
  textInverse: '#FFFFFF',

  // Status
  success: '#2E7D32',
  danger: '#C62828',
  warning: '#F9A825',

  // Misc
  muted: '#9E9E9E',
  skeleton: '#F0F0F0',
  overlay: 'rgba(0,0,0,0.45)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const theme = { colors, spacing, radius };

export default theme;
