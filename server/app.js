import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { query } from './db.js';
import { requireAuth } from './lib/auth.js';
import { mailConfigured } from './lib/mailer.js';
import { HttpError } from './lib/http.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import flowsRoutes from './routes/flows.js';
import stepsRoutes from './routes/steps.js';
import searchRoutes from './routes/search.js';
import ioRoutes from './routes/io.js';
import metaRoutes from './routes/meta.js';
import activityRoutes from './routes/activity.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();

app.set('trust proxy', 1); // behind Vercel / nginx: needed for correct client IPs in rate limiting
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

// CSRF guard: browsers cannot add custom headers to cross-site requests without CORS
// (which this API never allows), so every write must carry X-Requested-With: pfm.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'pfm') {
    return res.status(403).json({ error: 'Request blocked (missing X-Requested-With header)' });
  }
  next();
});

// Public: used to check the deployment can reach the database and send login emails.
app.get('/api/health', async (_req, res) => {
  const email = mailConfigured() ? 'configured' : 'not configured';
  try {
    await query('SELECT 1');
    res.json({ ok: true, database: 'connected', email });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(500).json({ ok: false, database: 'unreachable', email });
  }
});

app.use('/api/auth', authRoutes);

// Everything below requires a logged-in user.
app.use('/api', requireAuth);
app.use('/api/users', usersRoutes);
app.use('/api/flows', flowsRoutes);
app.use('/api/steps', stepsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', ioRoutes); // /api/export, /api/import

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  if (err.type === 'entity.too.large') {
    status = 413;
    message = 'The file is too large. Split it into smaller imports.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON in request body';
  }
  if (status >= 500 && !(err instanceof HttpError)) {
    console.error(err);
    message = 'Something went wrong on the server. Please try again.';
  }
  res.status(status).json({ error: message });
});

export default app;
