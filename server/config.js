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

const smtpPort = Number(process.env.SMTP_PORT || 587);

export const config = {
  isProd,
  databaseUrl: required('DATABASE_URL'),
  // TiDB Cloud, PlanetScale, Aiven etc. need TLS. Local MySQL usually does not.
  dbSsl: (process.env.DB_SSL || 'false').toLowerCase() === 'true',
  jwtSecret,
  sessionDays: Number(process.env.SESSION_DAYS || 7),
  cookieName: 'pfm_session',
  port: Number(process.env.PORT || 4000),

  // Email used to send login codes. If SMTP_HOST is empty in local development,
  // codes are printed in the terminal instead of being emailed.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: smtpPort,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE.toLowerCase() === 'true' : smtpPort === 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || '',

  otp: {
    length: 6,
    ttlMinutes: 10,
    maxAttempts: 5, // wrong tries allowed per code
    resendSeconds: 60, // wait between codes for the same user
    maxPerHour: 6, // codes per user per hour
  },
};
