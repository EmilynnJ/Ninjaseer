# Vercel Deployment Guide for SoulSeer

This guide will walk you through deploying the SoulSeer monorepo to Vercel.

## Prerequisites

- GitHub account with the SoulSeer repository
- Vercel account (sign up at https://vercel.com)
- All required API keys (Clerk, Stripe, Agora, Neon)

## Step 1: Prepare Your Repository

The repository is already configured with:
- ✅ `vercel.json` - Vercel configuration
- ✅ Root `package.json` - Monorepo setup
- ✅ Frontend and Backend package.json files

## Step 2: Connect to Vercel

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository: `EmilynnJ/Ninjaseer`
4. Click "Import"

## Step 3: Configure Project Settings

### Framework Preset
- Select: **Next.js**

### Root Directory
- Leave as: `./` (root)
- Vercel will automatically detect the monorepo structure

### Build Settings
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `frontend/.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

### Node.js Version
- Select: **20.x** (recommended)

## Step 4: Add Environment Variables

Click "Environment Variables" and add the following:

### Frontend Variables
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api
```

### Backend Variables (if deploying backend to Vercel)
```
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
PORT=5000
```

**Important**: Set environment for all three: Production, Preview, and Development

## Step 5: Deploy

1. Click "Deploy"
2. Wait for the build to complete (usually 2-3 minutes)
3. Once deployed, you'll get a URL like: `https://your-app.vercel.app`

## Step 6: Deploy Backend Separately

Since Vercel is optimized for frontend, deploy your backend to a separate service:

### Option A: Railway (Recommended)
1. Go to https://railway.app
2. Connect your GitHub repository
3. Select the `backend` folder
4. Add environment variables
5. Deploy

### Option B: Render
1. Go to https://render.com
2. Create new Web Service
3. Connect GitHub repository
4. Set Root Directory: `backend`
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Add environment variables
8. Deploy

### Option C: Heroku
```bash
cd backend
heroku create your-app-backend
heroku config:set DATABASE_URL=your_neon_url
heroku config:set CLERK_SECRET_KEY=your_clerk_secret
# ... add other env vars
git push heroku main
```

## Step 7: Update Frontend API URL

After deploying the backend, update the frontend environment variable:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `NEXT_PUBLIC_API_URL` to your backend URL
3. Redeploy the frontend

## Step 8: Configure Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain (e.g., `soulseer.com`)
3. Follow DNS configuration instructions
4. Wait for SSL certificate to be issued

## Step 9: Set Up Webhooks

### Stripe Webhooks
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-backend-url.com/api/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy webhook secret and add to backend env vars

### Clerk Webhooks
1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://your-backend-url.com/api/webhooks/clerk`
3. Select events: `user.created`, `user.updated`
4. Copy webhook secret and add to backend env vars

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify Node.js version is 20.x

### Environment Variables Not Working
- Make sure variables are set for all environments
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

### API Calls Failing
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS settings in backend
- Ensure backend is deployed and running

### Database Connection Issues
- Verify Neon database URL is correct
- Check database is accessible from backend server
- Run database migrations

## Continuous Deployment

Vercel automatically deploys when you push to GitHub:

- **Push to `main`**: Deploys to production
- **Push to other branches**: Creates preview deployment
- **Pull Requests**: Automatic preview deployments

## Monitoring

1. **Vercel Analytics**: Built-in performance monitoring
2. **Vercel Logs**: Real-time function logs
3. **Error Tracking**: Set up Sentry or similar service

## Scaling

Vercel automatically scales based on traffic:
- **Serverless Functions**: Auto-scale
- **Edge Network**: Global CDN
- **Bandwidth**: Unlimited on Pro plan

## Cost Estimation

### Vercel Pricing
- **Hobby**: Free (personal projects)
- **Pro**: $20/month (commercial projects)
- **Enterprise**: Custom pricing

### Additional Services
- **Neon**: $19/month (Pro plan)
- **Clerk**: $25/month (Pro plan)
- **Stripe**: 2.9% + 30¢ per transaction
- **Agora**: Pay-as-you-go

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Support: support@vercel.com
- Community: https://github.com/vercel/vercel/discussions

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Deploy backend separately
3. ✅ Configure environment variables
4. ✅ Set up custom domain
5. ✅ Configure webhooks
6. ✅ Test all features
7. ✅ Monitor performance
8. ✅ Set up error tracking

Your SoulSeer app is now live! 🎉