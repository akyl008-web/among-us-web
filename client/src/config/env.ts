/** Empty string → same origin (Vite proxy in dev, same host in production). */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL?.trim() ?? '';
