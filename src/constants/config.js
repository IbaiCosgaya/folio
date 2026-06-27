// src/constants/config.js
// ─────────────────────────────────────────────────────────────────────────────
// App-wide configuration constants.
// Values that used to be hardcoded in multiple files live here only.
// ─────────────────────────────────────────────────────────────────────────────

// Admin user UUID — read from env so it never needs to be changed in source.
// In .env: VITE_ADMIN_ID=581dd0d6-6240-461a-90b7-224f74d577ab
export const ADMIN_ID =
  import.meta.env.VITE_ADMIN_ID ?? '581dd0d6-6240-461a-90b7-224f74d577ab'