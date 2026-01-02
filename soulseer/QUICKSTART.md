# SoulSeer Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 20.x installed
- Python 3.11 installed
- PostgreSQL database (Neon recommended)
- Clerk account (free tier available)
- Stripe account (test mode)
- Agora account (free tier available)

### Step 1: Database Setup (2 minutes)

1. Create a Neon PostgreSQL database at https://neon.tech
2. Copy your connection string
3. Run the schema:
```bash
cd soulseer/backend
psql YOUR_DATABASE_URL -f config/schema.sql
```

### Step 2: Backend Setup (1 minute)

```bash
cd soulseer/backend
npm install
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
DATABASE_URL=your_neon_connection_string
CLERK_SECRET_KEY=your_clerk_secret
STRIPE_SECRET_KEY=your_stripe_secret
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
```

Start the backend:
```bash
npm run dev
```

Backend will run on http://localhost:5000

### Step 3: Frontend Setup (1 minute)

```bash
cd soulseer/frontend
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id
```

Start the frontend:
```bash
npm run dev
```

Frontend will run on http://localhost:3000

### Step 4: Admin Panel Setup (1 minute)

```bash
cd soulseer/admin-panel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=your_neon_connection_string
SECRET_KEY=generate_a_random_secret_key
STRIPE_SECRET_KEY=your_stripe_secret
```

Run migrations and create admin:
```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

Admin panel will run on http://localhost:8000/admin

## 🎉 You're Ready!

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Admin Panel**: http://localhost:8000/admin

### First Steps

1. **Create a Reader Account**:
   - Go to http://localhost:8000/admin
   - Login with your superuser credentials
   - Navigate to "Reader Profiles"
   - Click "Add Reader Profile"
   - Fill in the details and save

2. **Test the Frontend**:
   - Visit http://localhost:3000
   - Browse the mystical homepage
   - View online readers
   - Check out live streams section

3. **Test a Reading Session**:
   - Sign up as a client on the frontend
   - Add balance to your account
   - Connect with an online reader
   - Start a chat/call/video session

## 🔑 Getting API Keys

### Clerk (Authentication)
1. Go to https://clerk.com
2. Create a free account
3. Create a new application
4. Copy your publishable and secret keys

### Stripe (Payments)
1. Go to https://stripe.com
2. Create an account
3. Switch to test mode
4. Get your test API keys from Dashboard > Developers > API keys

### Agora (Live Streaming)
1. Go to https://www.agora.io
2. Sign up for free
3. Create a project
4. Get your App ID and App Certificate

## 🐛 Troubleshooting

### Backend won't start
- Check if PostgreSQL is running
- Verify DATABASE_URL is correct
- Ensure all environment variables are set

### Frontend won't start
- Clear node_modules: `rm -rf node_modules && npm install`
- Check if backend is running on port 5000
- Verify NEXT_PUBLIC_API_URL is correct

### Admin panel errors
- Run migrations: `python manage.py migrate`
- Check DATABASE_URL matches backend
- Ensure virtual environment is activated

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore the API endpoints
- Customize the mystical theme
- Add more reader profiles
- Test payment flows
- Configure live streaming

## 💡 Tips

- Use test mode for Stripe during development
- Keep your API keys secure and never commit them
- The cosmic background animations are GPU-accelerated
- Mobile-first design ensures great experience on all devices
- WebRTC sessions are peer-to-peer for low latency

---

**Need Help?** Contact NinjaTech AI team