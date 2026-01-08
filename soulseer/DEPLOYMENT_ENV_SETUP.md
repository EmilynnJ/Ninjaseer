# Environment Variables Setup Guide

## Overview
This guide shows exactly what environment variables to configure in your deployment platform (Netlify/Vercel).

## Frontend Environment Variables (Netlify/Vercel)

### Required Variables:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api
```

### Variable Descriptions:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk authentication public key (get from Clerk dashboard)
- `CLERK_SECRET_KEY` - Clerk authentication secret key (get from Clerk dashboard)
- `NEXT_PUBLIC_API_URL` - Your deployed backend API URL (update after backend deployment)

## Backend Environment Variables (Railway/Render/Heroku)

### Required Variables:
```
DATABASE_URL=your_neon_database_url
CLERK_SECRET_KEY=your_clerk_secret_key
AGORA_APP_ID=get_from_agora_console
AGORA_APP_CERTIFICATE=get_from_agora_console
STRIPE_SECRET_KEY=get_from_stripe_dashboard
PORT=5000
```

### Variable Descriptions:
- `DATABASE_URL` - Neon PostgreSQL connection string (get from neon.tech)
- `CLERK_SECRET_KEY` - Clerk authentication (same as frontend)
- `AGORA_APP_ID` - Agora RTC/RTM application ID (get from agora.io)
- `AGORA_APP_CERTIFICATE` - Agora certificate (get from agora.io)
- `STRIPE_SECRET_KEY` - Stripe API secret key (get from stripe.com)
- `PORT` - Backend server port (5000)

## Setup Steps

### Step 1: Configure Netlify/Vercel (Frontend)
1. Go to your Netlify/Vercel project settings
2. Navigate to "Environment Variables"
3. Add all frontend variables listed above
4. Save and redeploy

### Step 2: Configure Backend Deployment Platform
1. Deploy backend to Railway/Render/Heroku
2. Add all backend environment variables
3. Update `NEXT_PUBLIC_API_URL` in frontend with your backend URL

### Step 3: Get Missing API Keys
You still need to obtain:
- **Agora Credentials**: https://console.agora.io
  - Sign up and create a project
  - Get App ID and App Certificate
  
- **Stripe Keys**: https://dashboard.stripe.com
  - Sign up or log in
  - Get Secret Key from Developers > API keys

- **Neon Database**: https://neon.tech
  - Sign up and create project
  - Get connection string from dashboard

## Testing
After setup:
1. Test database connection: Check backend logs for "Connected to PostgreSQL"
2. Test authentication: Try signing in/up
3. Test readings: Verify Agora integration works
4. Test payments: Ensure Stripe connection is valid

## Security Notes
- Never commit `.env` files to git
- Use different keys for development and production
- Rotate keys if accidentally exposed
- Keep `DATABASE_URL` and `STRIPE_SECRET_KEY` secure
- Local `.env` files are already in `.gitignore`