// In Capacitor native (file://), relative /api/ calls fail.
// Set VITE_API_BASE_URL in .env.capacitor to your production URL.
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
