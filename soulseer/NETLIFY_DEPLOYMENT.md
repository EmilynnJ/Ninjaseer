# Netlify Deployment Guide for SoulSeer

This guide will walk you through deploying the SoulSeer monorepo to Netlify.

## Prerequisites

- GitHub account with the SoulSeer repository
- Netlify account (sign up at https://netlify.com)
- All required API keys (Clerk, Stripe, Agora, Neon)

## Step 1: Prepare Your Repository

The repository is already configured with:
- ✅ `netlify.toml` - Netlify configuration
- ✅ Root `package.json` - Monorepo setup
- ✅ Frontend and Backend package.json files

## Step 2: Connect to Netlify

1. Go to https://app.netlify.com/start
2. Click "Import from Git"
3. Select "GitHub"
4. Authorize Netlify to access your repositories
5. Select your repository: `EmilynnJ/Ninjaseer`

## Step 3: Configure Build Settings

Netlify should auto-detect settings from `netlify.toml`, but verify:

### Basic Build Settings
- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `frontend/.next`
- **Functions directory**: `backend` (for serverless functions)

### Advanced Build Settings
- **Node version**: `20`
- **Package manager**: `npm`

## Step 4: Add Environment Variables

Go to Site Settings → Environment Variables and add:

### Frontend Variables
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api
```

### Backend Variables (for Netlify Functions)
```
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

**Note**: Environment variables are available in all deploy contexts by default

## Step 5: Deploy

1. Click "Deploy site"
2. Wait for the build to complete (usually 2-4 minutes)
3. Once deployed, you'll get a URL like: `https://your-app.netlify.app`

## Step 6: Backend Deployment Options

### Option A: Netlify Functions (Serverless)
Convert your Express routes to Netlify Functions:

1. Create `netlify/functions` directory
2. Convert each route to a serverless function
3. Deploy with frontend

**Pros**: Single deployment, automatic scaling
**Cons**: Cold starts, function timeout limits

### Option B: Separate Backend Service (Recommended)

Deploy backend to a dedicated service:

#### Railway
1. Go to https://railway.app
2. Connect GitHub repository
3. Select `backend` folder
4. Add environment variables
5. Deploy

#### Render
1. Go to https://render.com
2. Create new Web Service
3. Connect GitHub repository
4. Set Root Directory: `backend`
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Add environment variables
8. Deploy

#### Heroku
```bash
cd backend
heroku create your-app-backend
heroku config:set DATABASE_URL=your_neon_url
# ... add other env vars
git push heroku main
```

## Step 7: Update Frontend API URL

After deploying the backend:

1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Update `NEXT_PUBLIC_API_URL` to your backend URL
3. Trigger a new deploy

## Step 8: Configure Custom Domain

1. Go to Site Settings → Domain Management
2. Click "Add custom domain"
3. Enter your domain (e.g., `soulseer.com`)
4. Follow DNS configuration instructions:
   - Add A record pointing to Netlify's load balancer
   - Or add CNAME record pointing to your Netlify subdomain
5. Wait for SSL certificate (automatic via Let's Encrypt)

## Step 9: Set Up Redirects and Rewrites

The `netlify.toml` already includes:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This handles:
- API routes → Netlify Functions
- SPA routing → index.html

## Step 10: Configure Webhooks

### Stripe Webhooks
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-backend-url.com/api/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy webhook secret and add to env vars

### Clerk Webhooks
1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://your-backend-url.com/api/webhooks/clerk`
3. Select events: `user.created`, `user.updated`
4. Copy webhook secret and add to env vars

## Netlify Features to Enable

### 1. Deploy Previews
- Automatically creates preview for each PR
- Enable in: Site Settings → Build & Deploy → Deploy Contexts

### 2. Split Testing
- A/B test different versions
- Enable in: Site Settings → Split Testing

### 3. Forms
- Handle contact forms without backend
- Enable in: Site Settings → Forms

### 4. Analytics
- Built-in analytics (paid feature)
- Enable in: Site Settings → Analytics

### 5. Edge Functions
- Run code at the edge for better performance
- Enable in: Site Settings → Functions

## Troubleshooting

### Build Fails
- Check build logs in Netlify dashboard
- Verify `netlify.toml` configuration
- Ensure Node.js version is 20

### Environment Variables Not Working
- Check variable names (case-sensitive)
- Redeploy after adding variables
- Verify variables are set for correct context

### API Calls Failing
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS settings in backend
- Ensure backend is deployed and accessible

### Redirect Issues
- Check `netlify.toml` redirect rules
- Test with `netlify dev` locally
- Review redirect logs in dashboard

### Function Timeout
- Netlify Functions timeout after 10s (free) or 26s (pro)
- For long-running tasks, use separate backend service

## Continuous Deployment

Netlify automatically deploys when you push to GitHub:

- **Push to `main`**: Deploys to production
- **Push to other branches**: Creates deploy preview
- **Pull Requests**: Automatic preview deployments with unique URLs

## Performance Optimization

### 1. Enable Asset Optimization
- Minify CSS, JS, and images
- Enable in: Site Settings → Build & Deploy → Post Processing

### 2. Configure Caching
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 3. Use Netlify CDN
- Automatic global CDN
- No configuration needed

### 4. Enable HTTP/2 Server Push
```toml
[[headers]]
  for = "/"
  [headers.values]
    Link = "</styles.css>; rel=preload; as=style"
```

## Monitoring

1. **Netlify Analytics**: Real-time traffic data
2. **Function Logs**: View function execution logs
3. **Deploy Notifications**: Slack, email, or webhook
4. **Error Tracking**: Integrate Sentry or similar

## Scaling

### Free Tier Limits
- 100GB bandwidth/month
- 300 build minutes/month
- 125k function invocations/month

### Pro Tier ($19/month)
- 1TB bandwidth/month
- Unlimited build minutes
- 2M function invocations/month

### Enterprise
- Custom limits
- SLA guarantees
- Priority support

## Cost Estimation

### Netlify Pricing
- **Starter**: Free (personal projects)
- **Pro**: $19/month per member
- **Enterprise**: Custom pricing

### Additional Services
- **Neon**: $19/month (Pro plan)
- **Clerk**: $25/month (Pro plan)
- **Stripe**: 2.9% + 30¢ per transaction
- **Agora**: Pay-as-you-go

## CLI Deployment (Alternative)

Install Netlify CLI:
```bash
npm install -g netlify-cli
```

Login and deploy:
```bash
netlify login
cd soulseer
netlify init
netlify deploy --prod
```

## Support

- Netlify Docs: https://docs.netlify.com
- Netlify Support: https://www.netlify.com/support
- Community: https://answers.netlify.com

## Next Steps

1. ✅ Deploy to Netlify
2. ✅ Deploy backend separately
3. ✅ Configure environment variables
4. ✅ Set up custom domain
5. ✅ Configure webhooks
6. ✅ Enable deploy previews
7. ✅ Test all features
8. ✅ Monitor performance

Your SoulSeer app is now live on Netlify! 🎉