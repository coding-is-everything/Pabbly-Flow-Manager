// Vercel serverless entry point. vercel.json rewrites every /api/* request here,
// and the Express app routes it (the original URL is preserved).
import app from '../server/app.js';

export default app;
