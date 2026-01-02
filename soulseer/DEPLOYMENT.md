# SoulSeer Deployment Guide

## Prerequisites

- GitHub account
- Vercel account (for frontend)
- Railway/Heroku account (for backend)
- Neon PostgreSQL database
- Clerk account (production app)
- Stripe account (live mode)
- Agora account (production project)

## 1. Database Setup (Neon)

### Create Production Database

1. Go to https://neon.tech
2. Create a new project: "soulseer-production"
3. Copy the connection string
4. Run the schema:

```bash
psql "your-neon-connection-string" -f backend/config/schema.sql
```

### Verify Tables

```sql
\dt  -- List all tables
SELECT COUNT(*) FROM users;  -- Should return 0
```

## 2. Backend Deployment (Railway)

### Setup Railway Project

1. Go to https://railway.app
2. Create new project: "soulseer-backend"
3. Connect GitHub repository
4. Select `soulseer/backend` directory

### Configure Environment Variables

Add these in Railway dashboard:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=your-neon-connection-string
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate
PLATFORM_COMMISSION=0.30
READER_COMMISSION=0.70
MINIMUM_PAYOUT=15.00
SESSION_SECRET=generate-random-secret
JWT_SECRET=generate-random-secret
```

### Deploy

```bash
# Railway will auto-deploy on git push
git add .
git commit -m "Deploy backend"
git push origin main
```

### Verify Deployment

```bash
curl https://your-railway-url.railway.app/health
# Should return: {"status":"ok","message":"SoulSeer API is running"}
```

## 3. Frontend Deployment (Vercel)

### Setup Vercel Project

1. Go to https://vercel.com
2. Import GitHub repository
3. Select `soulseer/frontend` directory
4. Framework Preset: Next.js

### Configure Environment Variables

Add these in Vercel dashboard:

```env
NEXT_PUBLIC_API_URL=https://your-railway-url.railway.app
NEXT_PUBLIC_WS_URL=wss://your-railway-url.railway.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
NEXT_PUBLIC_AGORA_APP_ID=your-agora-app-id
```

### Deploy

```bash
# Vercel will auto-deploy on git push
git add .
git commit -m "Deploy frontend"
git push origin main
```

### Custom Domain (Optional)

1. Go to Vercel project settings
2. Add custom domain: `soulseer.com`
3. Configure DNS records as instructed
4. Enable HTTPS (automatic)

## 4. Admin Panel Deployment (Heroku)

### Setup Heroku App

```bash
cd soulseer/admin-panel
heroku create soulseer-admin
heroku addons:create heroku-postgresql:mini
```

### Configure Environment Variables

```bash
heroku config:set SECRET_KEY=generate-random-secret
heroku config:set DATABASE_URL=your-neon-connection-string
heroku config:set BACKEND_API_URL=https://your-railway-url.railway.app
heroku config:set STRIPE_SECRET_KEY=sk_live_xxxxx
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
heroku config:set ALLOWED_HOSTS=soulseer-admin.herokuapp.com
heroku config:set DEBUG=False
```

### Create Procfile

```bash
echo "web: gunicorn soulseer_admin.wsgi" > Procfile
```

### Add Gunicorn to requirements.txt

```bash
echo "gunicorn==21.2.0" >> requirements.txt
```

### Deploy

```bash
git add .
git commit -m "Deploy admin panel"
git push heroku main
```

### Run Migrations

```bash
heroku run python manage.py migrate
heroku run python manage.py createsuperuser
```

### Collect Static Files

```bash
heroku run python manage.py collectstatic --noinput
```

## 5. Configure Webhooks

### Stripe Webhooks

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-railway-url.railway.app/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
4. Copy webhook secret and add to Railway env vars

### Clerk Webhooks

1. Go to Clerk Dashboard > Webhooks
2. Add endpoint: `https://your-railway-url.railway.app/api/auth/webhook`
3. Select events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy webhook secret and add to Railway env vars

## 6. Setup Cron Jobs

### Daily Payouts (Railway)

1. Install Railway CLI: `npm i -g @railway/cli`
2. Create cron job:

```bash
railway run node scripts/daily-payouts.js
```

3. Configure Railway Cron:
   - Go to Railway dashboard
   - Add Cron trigger
   - Schedule: `0 0 * * *` (daily at midnight)
   - Command: `node scripts/daily-payouts.js`

### Session Cleanup

```bash
# Add to cron
0 2 * * * node scripts/cleanup-sessions.js
```

## 7. SSL/Security Configuration

### Enable HTTPS

- Vercel: Automatic
- Railway: Automatic
- Heroku: Automatic

### Configure CORS

Update backend CORS settings:

```javascript
app.use(cors({
  origin: [
    'https://soulseer.com',
    'https://www.soulseer.com',
    'https://soulseer-admin.herokuapp.com'
  ],
  credentials: true
}));
```

### Security Headers

Add to backend:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

## 8. Monitoring Setup

### Error Tracking (Sentry)

```bash
npm install @sentry/node @sentry/nextjs
```

Configure in backend:

```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Uptime Monitoring

1. Use UptimeRobot or similar
2. Monitor endpoints:
   - Frontend: `https://soulseer.com`
   - Backend: `https://your-railway-url.railway.app/health`
   - Admin: `https://soulseer-admin.herokuapp.com/admin`

## 9. Performance Optimization

### Frontend

```bash
# Enable Next.js optimizations
npm run build
npm run start
```

### Database

```sql
-- Create indexes for performance
CREATE INDEX idx_sessions_active ON reading_sessions(status) WHERE status = 'active';
CREATE INDEX idx_readers_online ON reader_profiles(is_online) WHERE is_online = true;
```

### CDN

1. Configure Vercel CDN (automatic)
2. Upload static assets to CDN
3. Update image URLs

## 10. Backup Strategy

### Database Backups

```bash
# Daily automated backups (Neon)
# Configure in Neon dashboard
# Retention: 7 days

# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Code Backups

```bash
# GitHub automatic
# Additional backup to S3
aws s3 sync . s3://soulseer-backups/code/
```

## 11. Post-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database schema deployed
- [ ] Webhooks configured and tested
- [ ] SSL certificates active
- [ ] CORS configured correctly
- [ ] Cron jobs scheduled
- [ ] Error tracking enabled
- [ ] Monitoring alerts set up
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

## 12. Rollback Procedure

### Frontend Rollback

```bash
# Vercel dashboard > Deployments > Previous deployment > Promote
```

### Backend Rollback

```bash
# Railway dashboard > Deployments > Previous deployment > Redeploy
```

### Database Rollback

```bash
# Restore from backup
psql $DATABASE_URL < backup-YYYYMMDD.sql
```

## 13. Scaling Strategy

### Horizontal Scaling

- Railway: Increase replicas in dashboard
- Vercel: Automatic scaling
- Database: Upgrade Neon plan

### Vertical Scaling

- Railway: Upgrade instance size
- Neon: Upgrade compute units

## Support

For deployment issues, contact NinjaTech AI team.

---

**Deployment Guide v1.0**