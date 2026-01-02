# SoulSeer Architecture Documentation

## System Overview

SoulSeer is a full-stack application built with a microservices-inspired architecture, featuring three main components:

1. **Node.js Backend** - RESTful API and WebRTC signaling server
2. **Next.js Frontend** - Server-side rendered React application
3. **Django Admin Panel** - Administrative interface for platform management

## Technology Stack

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **Authentication**: Clerk
- **Payments**: Stripe + Stripe Connect
- **Real-time**: Socket.io + Custom WebRTC
- **Live Streaming**: Agora SDK

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Real-time**: Socket.io Client + WebRTC
- **Streaming**: Agora React SDK

### Admin Panel
- **Framework**: Django 5.0
- **Database ORM**: Django ORM
- **Admin Interface**: Django Admin
- **API Integration**: Requests library

## Database Schema

### Core Tables

#### users
- Stores all user accounts (clients, readers, admins)
- Integrates with Clerk for authentication
- Tracks user balance for clients

#### reader_profiles
- Extended profile information for readers
- Rates for different session types
- Earnings and payout tracking
- Stripe Connect account ID

#### reading_sessions
- Tracks all reading sessions
- Real-time minute tracking
- Revenue split calculation
- Chat transcript storage

#### transactions
- All financial transactions
- Balance changes
- Stripe payment/transfer IDs

#### live_streams
- Live streaming sessions
- Agora channel information
- Viewer count and gift tracking

#### products
- Marketplace items
- Stripe product sync
- Inventory management

## API Architecture

### RESTful Endpoints

```
/api
├── /readers
│   ├── GET / - List all readers
│   ├── GET /:id - Get reader details
│   ├── PUT /profile - Update reader profile
│   └── PUT /status - Update online status
│
├── /sessions
│   ├── POST /start - Start reading session
│   ├── POST /end/:id - End session
│   ├── GET /:id - Get session details
│   └── POST /:id/review - Submit review
│
├── /payments
│   ├── POST /add-balance - Add client balance
│   ├── GET /balance - Get current balance
│   ├── GET /transactions - Transaction history
│   └── POST /webhook - Stripe webhooks
│
├── /streams
│   ├── POST /create - Create live stream
│   ├── POST /:id/join - Join stream
│   ├── POST /:id/gift - Send virtual gift
│   └── GET /live - List live streams
│
└── /admin
    ├── POST /readers - Create reader account
    ├── GET /stats - Platform statistics
    ├── GET /disputes - Get disputed sessions
    └── POST /payouts/process - Process daily payouts
```

### WebSocket Events

```javascript
// Client -> Server
'join-reading' - Join reading room
'offer' - WebRTC offer
'answer' - WebRTC answer
'ice-candidate' - ICE candidate
'chat-message' - Send chat message
'end-session' - End reading session

// Server -> Client
'user-joined' - User joined room
'offer' - WebRTC offer
'answer' - WebRTC answer
'ice-candidate' - ICE candidate
'chat-message' - Receive chat message
'session-ended' - Session ended
```

## Payment Flow

### Client Balance System

1. **Add Balance**
   ```
   Client -> Stripe Payment Intent -> Backend
   Backend -> Verify Payment -> Update Balance
   Backend -> Create Transaction Record
   ```

2. **Reading Session Charge**
   ```
   Session Start -> Check Balance
   Every Minute -> Deduct Rate from Balance
   Session End -> Final Calculation
   Backend -> Split Revenue (70/30)
   Backend -> Update Reader Earnings
   ```

3. **Daily Payouts**
   ```
   Cron Job -> Check Pending Payouts >= $15
   Backend -> Stripe Transfer to Reader
   Backend -> Update Reader Balance
   Backend -> Create Transaction Record
   ```

## WebRTC Architecture

### Session Flow

1. **Initiation**
   ```
   Client -> POST /api/sessions/start
   Backend -> Create Session Record
   Backend -> Return Room ID + ICE Servers
   ```

2. **Connection**
   ```
   Client A -> Socket.io Connect
   Client A -> Join Room
   Client B -> Socket.io Connect
   Client B -> Join Room
   Client A -> Send Offer
   Client B -> Receive Offer
   Client B -> Send Answer
   Client A -> Receive Answer
   Both -> Exchange ICE Candidates
   Both -> Establish P2P Connection
   ```

3. **Billing**
   ```
   Backend -> Start Timer on Session Start
   Every Minute -> Increment Duration
   Every Minute -> Calculate Cost
   Session End -> Final Billing
   Backend -> Deduct from Client
   Backend -> Add to Reader Earnings
   ```

## Live Streaming Architecture

### Agora Integration

1. **Stream Creation**
   ```
   Reader -> POST /api/streams/create
   Backend -> Generate Agora Channel
   Backend -> Generate Publisher Token
   Backend -> Return Stream Config
   ```

2. **Viewer Join**
   ```
   Viewer -> POST /api/streams/:id/join
   Backend -> Generate Subscriber Token
   Backend -> Increment Viewer Count
   Backend -> Return Stream Config
   ```

3. **Virtual Gifting**
   ```
   Viewer -> POST /api/streams/:id/gift
   Backend -> Check Balance
   Backend -> Deduct from Viewer
   Backend -> Add to Reader Earnings (70%)
   Backend -> Platform Fee (30%)
   Backend -> Broadcast Gift Event
   ```

## Security Measures

### Authentication
- Clerk JWT tokens for all authenticated requests
- Role-based access control (RBAC)
- Session management with secure cookies

### Payment Security
- Stripe PCI compliance
- Tokenized card storage
- Webhook signature verification
- Fraud detection

### Data Protection
- PostgreSQL SSL connections
- Environment variable encryption
- HTTPS only in production
- CORS configuration

### Rate Limiting
- API endpoint rate limits
- WebSocket connection limits
- Payment attempt limits

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Session data in database
- WebSocket sticky sessions
- Load balancer ready

### Database Optimization
- Indexed foreign keys
- Query optimization
- Connection pooling
- Read replicas for analytics

### Caching Strategy
- Redis for session data (future)
- CDN for static assets
- API response caching
- Database query caching

## Monitoring & Logging

### Application Logs
- Request/response logging
- Error tracking
- Performance metrics
- User activity logs

### Business Metrics
- Active sessions
- Revenue tracking
- User engagement
- Conversion rates

## Deployment Architecture

### Production Setup
```
┌─────────────┐
│   Vercel    │ <- Next.js Frontend
└─────────────┘
       │
       ↓
┌─────────────┐
│   Railway   │ <- Node.js Backend
└─────────────┘
       │
       ↓
┌─────────────┐
│    Neon     │ <- PostgreSQL Database
└─────────────┘

┌─────────────┐
│   Heroku    │ <- Django Admin Panel
└─────────────┘
```

### Environment Variables
- Separate configs for dev/staging/prod
- Secret management via platform
- Database connection pooling
- API key rotation

## Future Enhancements

### Phase 2
- Mobile apps (React Native)
- AI-powered reader matching
- Advanced analytics dashboard
- Multi-language support

### Phase 3
- Subscription plans
- Group readings
- Recorded session playback
- White-label solutions

---

**Built by NinjaTech AI**