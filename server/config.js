import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env (or set it in Vercel → Settings → Environment Variables).`);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
}

export const config = {
  isProd,
  databaseUrl: required('DATABASE_URL'),
  // TiDB Cloud, PlanetScale, Aiven etc. need TLS. Local MySQL usually does not.
  dbSsl: (process.env.DB_SSL || 'false').toLowerCase() === 'true',
  jwtSecret,
  sessionDays: Number(process.env.SESSION_DAYS || 7),
  cookieName: 'pfm_session',
  port: Number(process.env.PORT || 4000),
};
