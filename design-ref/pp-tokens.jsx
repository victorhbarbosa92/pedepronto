// =========================================================
// PEDEPRONTO · SISTEMA UNIFICADO (light + dark)
// Mesmos tokens, mesma hierarquia — adapta em qualquer dispositivo.
// =========================================================

const PP_LIGHT = {
  mode: "light",
  bg: "#F7F7F8",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFAFB",
  border: "#ECECEE",
  borderStrong: "#DFDFE3",
  text: "#0A0A0B",
  muted: "#6E6E76",
  subtle: "#A4A4AB",
  accent: "oklch(0.55 0.17 268)",
  accentText: "oklch(0.42 0.17 268)",
  accentSoft: "oklch(0.965 0.025 268)",
  accentInk: "#FFFFFF",
  success: "oklch(0.62 0.15 155)",
  warning: "oklch(0.72 0.16 75)",
  danger: "oklch(0.6 0.21 25)",
  info: "oklch(0.62 0.15 240)",
};

const PP_DARK = {
  mode: "dark",
  bg: "oklch(0.155 0.012 250)",
  surface: "oklch(0.205 0.013 250)",
  surfaceAlt: "oklch(0.245 0.014 250)",
  border: "oklch(0.29 0.013 250)",
  borderStrong: "oklch(0.36 0.015 250)",
  text: "oklch(0.96 0.005 250)",
  muted: "oklch(0.72 0.012 250)",
  subtle: "oklch(0.52 0.012 250)",
  accent: "oklch(0.86 0.18 128)",
  accentText: "oklch(0.92 0.18 128)",
  accentSoft: "oklch(0.86 0.18 128 / 0.16)",
  accentInk: "oklch(0.16 0.012 250)",
  success: "oklch(0.82 0.16 155)",
  warning: "oklch(0.82 0.16 75)",
  danger: "oklch(0.72 0.2 25)",
  info: "oklch(0.78 0.13 240)",
};

const PP_FONT = "'Geist', 'Inter', system-ui, sans-serif";
const PP_MONO = "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace";
