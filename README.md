# Oprix CTF Platform - Backend

**A production-ready SaaS platform for hosting Capture The Flag competitions**

[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)]()
[![NestJS](https://img.shields.io/badge/NestJS-11.0-red)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

---

## Overview

Oprix CTF is a complete, enterprise-grade platform for organizing and participating in Capture The Flag competitions. Built with **NestJS**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**.

### **Key Features**

**SaaS Multi-Tenancy** - SuperAdmin → Admin → User hierarchy  
**Real-time Leaderboards** - Individual, team, and global rankings with caching  
**Flag Submission Engine** - Rate-limited, secure flag validation  
**Team Management** - Captain-based system with invite codes  
**Competition Lifecycle** - Draft → Registration → Active → Completed  
**WebSocket Live Updates** - Real-time notifications and leaderboard updates  
**Background Jobs** - Cleanup, notifications, score recalculation  
**Health Monitoring** - Kubernetes-ready health checks  
**Audit Logging** - Complete system activity tracking  
**File Management** - Secure challenge file uploads/downloads  

---

## Architecture

### **SaaS Hierarchy**

```
SuperAdmin (Platform Owner)
    ↓ Creates admin accounts
Admin (CTF Hoster) 
    ↓ Creates competitions, manages players
User (CTF Player)
    ↓ Participates in competitions
```

### **Technology Stack**

- **Framework:** NestJS 11.x
- **Language:** TypeScript 5.x
- **Database:** PostgreSQL 14+ with Prisma ORM
- **Authentication:** Clerk + JWT
- **Real-time:** Socket.io WebSocket
- **Caching:** In-memory (Redis optional)
- **Jobs:** Bull with Redis
- **Documentation:** Swagger/OpenAPI

---

## Quick Start

### **Prerequisites**

- Node.js 18+ (LTS recommended)
- PostgreSQL 14+
- Redis 6+ (optional for jobs)
- npm or yarn

### **1. Installation**

```bash
# Clone repository
cd backend

# Install dependencies
npm install
```

### **2. Environment Setup**

Create `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/oprix_ctf"

# Authentication
CLERK_FRONTEND_API=https://your-app.clerk.accounts.dev
CLERK_SECRET_KEY=sk_live_xxxxx
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# SuperAdmin (for seeding)
SUPERADMIN_PASSWORD=YourStrongPassword123!
```

### **3. Database Setup**

```bash
# Complete database setup (migrations + seed)
pnpm run db:setup

# Or step-by-step:
pnpm run prisma:generate  # Generate Prisma client
pnpm run prisma:migrate   # Run migrations
pnpm run prisma:seed      # Create SuperAdmin account
```

### **4. Start Development Server**

```bash
npm run start:dev
```

Server runs on `http://localhost:3000`

### **5. Access SuperAdmin**

**Default credentials (created by seed):**
- Email: `superadmin@oprix-ctf.com`
- Username: `superadmin`
- Password: Set via `SUPERADMIN_PASSWORD` env variable

---

## Documentation

| Document | Description |
|----------|-------------|
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Production deployment guide (Docker, PM2, Nginx) |
| **[API_GUIDE.md](./API_GUIDE.md)** | Complete API reference with examples |
| **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** | Full implementation details |
| **[Swagger Docs](http://localhost:3000/api/docs)** | Interactive API documentation |

---

## Available Scripts

```bash
# Development
pnpm run start:dev          # Start with hot-reload
pnpm run build              # Build for production
pnpm run start:prod         # Start production server

# Database
pnpm run prisma:generate    # Generate Prisma client
pnpm run prisma:migrate     # Run migrations
pnpm run prisma:seed        # Seed SuperAdmin
pnpm run db:setup           # Complete database setup

# Code Quality
pnpm run lint               # Lint code
pnpm run format             # Format code with Prettier

# Testing
pnpm run test               # Run unit tests
pnpm run test:e2e           # Run e2e tests
pnpm run test:cov           # Generate coverage report
```

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # SuperAdmin seeding
│   └── migrations/        # Database migrations
├── src/
│   ├── common/            # Shared utilities
│   │   ├── database/      # Prisma service
│   │   ├── guards/        # Auth guards
│   │   ├── decorators/    # Custom decorators
│   │   └── services/      # Crypto, rate-limit
│   ├── modules/
│   │   ├── auth/          # Authentication
│   │   ├── users/         # User management
│   │   ├── competitions/  # Competition CRUD
│   │   ├── challenges/    # Challenge management
│   │   ├── submissions/   # Flag submission
│   │   ├── teams/         # Team management
│   │   ├── leaderboard/   # Leaderboard service
│   │   ├── admin/         # Admin operations
│   │   ├── superadmin/    # SuperAdmin operations
│   │   ├── notifications/ # Notification system
│   │   ├── websockets/    # WebSocket gateway
│   │   ├── jobs/          # Background jobs
│   │   └── monitoring/    # Health checks
│   ├── config/            # Configuration
│   └── main.ts            # Application entry
├── uploads/               # File storage
├── .env                   # Environment variables
└── package.json
```

---

## Security Features

- **JWT Authentication** - Secure token-based auth
- **Role-Based Access Control** - SuperAdmin/Admin/User hierarchy
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - 5 submissions per minute per challenge
- **CORS Protection** - Configurable origins
- **Helmet Security** - HTTP security headers
- **Input Validation** - class-validator on all inputs
- **SQL Injection Prevention** - Prisma ORM parameterization
- **Secure Flag Storage** - Flags hashed, never exposed in API
- **Audit Logging** - All admin/superadmin actions logged

---

## Performance

- **Caching** - In-memory cache for leaderboards (30s TTL)
- **Database Indexing** - All foreign keys and timestamps indexed
- **Pagination** - All list endpoints support pagination
- **Connection Pooling** - Prisma connection pool
- **WebSocket** - Real-time updates without polling
- **Background Jobs** - Async processing with Bull
- **Lazy Loading** - Relations loaded on-demand

---

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov
```

---

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Run migrations
docker-compose exec backend npm run prisma:migrate

# Seed SuperAdmin
docker-compose exec backend npm run prisma:seed

# View logs
docker-compose logs -f backend
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete deployment guide.

---

## Troubleshooting

### **Database Connection Failed**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U oprix_admin -d oprix_ctf
```

### **Port Already in Use**
```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### **Prisma Client Not Generated**
```bash
npm run prisma:generate
```

---

## License

MIT License - see LICENSE file for details

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [PostgreSQL](https://www.postgresql.org/) - Advanced open source database
- [Socket.io](https://socket.io/) - Real-time engine
- [Bull](https://github.com/OptimalBits/bull) - Premium Queue package

---

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).


## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
