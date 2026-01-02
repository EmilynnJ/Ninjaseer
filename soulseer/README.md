# SoulSeer - A Community of Gifted Psychics

A premium platform connecting spiritual readers with clients seeking guidance through chat, call, and video readings, featuring live streaming and a mystical marketplace.

## 🌟 Features

### Core Functionality
- **Real-time Readings**: Pay-per-minute chat, voice, and video sessions using custom WebRTC
- **Live Streaming**: Agora-powered live streams with virtual gifting
- **Mystical Marketplace**: Digital and physical spiritual products
- **Community Forum**: Discussion boards and messaging
- **Admin Dashboard**: Django-based admin panel for reader and inventory management

### Payment System
- **Client Balance System**: Prepay and use credits for readings
- **70/30 Revenue Split**: Automatic distribution between readers and platform
- **Daily Payouts**: Automatic payouts to readers when balance exceeds $15
- **Stripe Integration**: Secure payment processing and Connect for reader payouts

### User Roles
- **Clients**: Book readings, join streams, purchase products
- **Readers**: Manage profiles, set rates, conduct sessions, stream live
- **Admins**: Full platform oversight, reader management, dispute resolution

## 🏗️ Architecture

### Backend (Node.js/Express)
- RESTful API with WebSocket support
- Custom WebRTC signaling server
- Real-time minute tracking and billing
- PostgreSQL (Neon) database
- Clerk authentication
- Stripe payment processing
- Agora live streaming integration

### Frontend (Next.js/React)
- Server-side rendering
- Responsive mobile-first design
- Mystical dark theme (pink, black, gold, white)
- Alex Brush and Playfair Display fonts
- Real-time WebRTC communication
- Agora SDK for live streaming

### Admin Panel (Django)
- Reader profile management
- Product/inventory management
- Stripe product synchronization
- Analytics dashboard
- Dispute resolution

## 📋 Prerequisites

- Node.js 20.x or higher
- Python 3.11 or higher
- PostgreSQL (Neon recommended)
- Clerk account
- Stripe account
- Agora account

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd soulseer
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your credentials
npm run dev
```

### 4. Admin Panel Setup
```bash
cd admin-panel
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

### 5. Database Setup
```bash
# Run the schema.sql file in your Neon PostgreSQL database
psql $DATABASE_URL -f backend/config/schema.sql
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/soulseer
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
AGORA_APP_ID=xxxxx
AGORA_APP_CERTIFICATE=xxxxx
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
NEXT_PUBLIC_AGORA_APP_ID=xxxxx
```

#### Admin Panel (.env)
```env
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:password@host:5432/soulseer
BACKEND_API_URL=http://localhost:5000
STRIPE_SECRET_KEY=sk_test_xxxxx
```

## 📱 Usage

### For Clients
1. Sign up and add balance to your account
2. Browse available readers
3. Start a reading (chat, call, or video)
4. Join live streams and send virtual gifts
5. Shop for spiritual products

### For Readers
1. Admin creates your account
2. Complete Stripe Connect onboarding
3. Set your rates and availability
4. Go online to accept readings
5. Start live streams
6. Manage your earnings

### For Admins
1. Access Django admin at http://localhost:8000/admin
2. Create and manage reader accounts
3. Upload reader profile pictures
4. Manage products and inventory
5. Handle disputes and refunds
6. View analytics and reports

## 🎨 Design System

### Colors
- **Mystical Pink**: #FF69B4
- **Dark Pink**: #FF1493
- **Gold**: #FFD700
- **Purple**: #9370DB
- **Black**: #000000
- **White**: #FFFFFF

### Typography
- **Headings**: Alex Brush (pink)
- **Body**: Playfair Display

### Theme
- Dark mode default
- Cosmic background with stars
- Mystical glow effects
- Smooth animations

## 🔐 Security

- End-to-end encryption for readings
- Clerk authentication
- Stripe PCI compliance
- Rate limiting on API endpoints
- CSRF protection
- SQL injection prevention
- XSS protection

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Readers
- `GET /api/readers` - Get all readers
- `GET /api/readers/:id` - Get reader details
- `PUT /api/readers/profile` - Update reader profile
- `PUT /api/readers/status` - Update reader status

### Sessions
- `POST /api/sessions/start` - Start reading session
- `POST /api/sessions/end/:id` - End reading session
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/:id/review` - Submit review

### Payments
- `POST /api/payments/add-balance` - Add balance
- `GET /api/payments/balance` - Get balance
- `GET /api/payments/transactions` - Get transaction history

### Streams
- `POST /api/streams/create` - Create live stream
- `POST /api/streams/:id/join` - Join stream
- `POST /api/streams/:id/gift` - Send virtual gift
- `GET /api/streams/live` - Get live streams

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 📦 Deployment

### Backend
1. Set up Neon PostgreSQL database
2. Configure environment variables
3. Deploy to your preferred platform (Heroku, Railway, etc.)
4. Run database migrations

### Frontend
1. Build the application: `npm run build`
2. Deploy to Vercel or similar platform
3. Configure environment variables

### Admin Panel
1. Set up production database
2. Configure environment variables
3. Run migrations: `python manage.py migrate`
4. Collect static files: `python manage.py collectstatic`
5. Deploy to your preferred platform

## 🤝 Contributing

This is a proprietary application built by NinjaTech AI.

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For support, contact NinjaTech AI team.

## 🎯 Roadmap

- [ ] Mobile apps (iOS/Android)
- [ ] AI-powered reader matching
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Subscription plans
- [ ] Group readings
- [ ] Recorded session playback

## 🙏 Acknowledgments

- Built with Next.js, Express, and Django
- Powered by Clerk, Stripe, and Agora
- Designed with Tailwind CSS
- Database hosted on Neon

---

**Built with ✨ by NinjaTech AI**