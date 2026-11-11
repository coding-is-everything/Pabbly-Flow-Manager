// Local development server. On Vercel, api/index.js is used instead.
import app from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}  (health: /api/health)`);
});
