# SoulSeer - A Community of Gifted Psychics

A full-stack spiritual guidance platform connecting psychic readers with clients through chat, voice, and video readings.

## 🌟 Features

- **Real-time Readings**: Chat, voice, and video sessions using Agora RTC/RTM
- **Live Streaming**: Psychic readers can host live streams with virtual gifting
- **Payment System**: Stripe integration with 70/30 revenue split
- **Authentication**: Clerk for secure user management
- **Marketplace**: Shop for spiritual products and services
- **Community**: Forum discussions and direct messaging
- **Pay-per-minute**: Automatic billing during reading sessions

## 🛠 Tech Stack

### Frontend
- Next.js 16.1.1 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Clerk Authentication
- Agora RTC/RTM SDK
- Stripe.js

### Backend
- Node.js 20+
- Express.js
- Socket.io (WebSocket)
- PostgreSQL (Neon)
- Stripe API
- Agora Token Server
- Clerk SDK

### Infrastructure
- **Deployment**: Vercel or Netlify (Monorepo)
- **Database**: Neon PostgreSQL
- **CDN**: Vercel Edge Network
- **Real-time**: Agora Cloud

## 📦 Monorepo Structure

```
soulseer/
├── frontend/          # Next.js application
│   ├── app/          # App router pages
│   ├── components/   # React components
│   └── public/       # Static assets
├── backend/          # Express API server
│   ├── routes/       # API endpoints
│   ├── services/     # Business logic
│   ├── config/       # Database & config
│   └── middleware/   # Auth & validation
├── admin-panel/      # Django admin (optional)
├── package.json      # Root monorepo config
├── vercel.json       # Vercel deployment config
└── netlify.toml      # Netlify deployment config
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm 10+
- PostgreSQL database (Neon recommended)
- Clerk account
- Stripe account
- Agora account

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/EmilynnJ/Ninjaseer.git
cd soulseer
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Set up environment variables**

Create `.env.local` in `frontend/`:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Create `.env` in `backend/`:
```env
DATABASE_URL=your_neon_postgres_url
CLERK_SECRET_KEY=your_clerk_secret
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
STRIPE_SECRET_KEY=your_stripe_secret
PORT=5000
```

4. **Set up database**
```bash
npm run db:setup
```

5. **Run development servers**
```bash
npm run dev
```

Frontend: http://localhost:3000
Backend: http://localhost:5000

## 🌐 Deployment

### Vercel (Recommended)

1. **Connect your GitHub repository to Vercel**
2. **Configure build settings**:
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `frontend/.next`

3. **Add environment variables** in Vercel dashboard

4. **Deploy**: Vercel will automatically deploy on push to main

### Netlify

1. **Connect your GitHub repository to Netlify**
2. **Configure build settings**:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/.next`

3. **Add environment variables** in Netlify dashboard

4. **Deploy**: Netlify will automatically deploy on push to main

### Backend Deployment

For production, deploy backend separately to:
- **Railway**: Automatic deployment from GitHub
- **Heroku**: Use Heroku CLI
- **Render**: Connect GitHub repository
- **AWS/GCP**: Use container deployment

## 📚 Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Detailed setup instructions
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and data flow
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Complete feature overview
- [FILE_INDEX.md](./FILE_INDEX.md) - Codebase structure

## 🔑 Environment Variables

### Frontend (.env.local)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_API_URL=
```

### Backend (.env)
```env
DATABASE_URL=
CLERK_SECRET_KEY=
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PORT=5000
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Frontend tests
npm run test:frontend

# Backend tests
npm run test:backend
```

## 📝 Scripts

```bash
npm run dev              # Run both frontend & backend
npm run build            # Build both apps
npm run start            # Start production servers
npm run install:all      # Install all dependencies
npm run clean            # Clean node_modules
npm run lint             # Lint all code
npm run db:setup         # Initialize database
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

ISC License

## 👥 Authors

Built by NinjaTech AI

## 🙏 Acknowledgments

- Agora for real-time communication
- Clerk for authentication
- Stripe for payment processing
- Vercel/Netlify for hosting