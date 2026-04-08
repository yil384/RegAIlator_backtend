# RegAIlator Backend

**AI-powered regulatory compliance platform** for managing supplier surveys, tracking PFAS/chemical compliance, and automating email-based supplier communication.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Email Processing Pipeline](#email-processing-pipeline)
- [AI/LLM Integration](#aillm-integration)
- [Deployment](#deployment)
- [Development Guide](#development-guide)

## Architecture Overview

```
                         +------------------+
                         |   React Frontend |
                         |  (regailator.com)|
                         +--------+---------+
                                  |
                           Nginx (reverse proxy)
                          /            \
                    HTTPS/REST      WebSocket
                        |               |
               +--------v---------------v--------+
               |        Express.js Server        |
               |        (port 3000)              |
               +--+------+------+------+------+--+
                  |      |      |      |      |
               Auth   Users  Videos  Email  Socket.io
               JWT   CRUD   Files   IMAP    (real-time)
                  |      |      |      |
               +--v------v------v------v---------+
               |          MongoDB                 |
               |   (users, videos, materials...) |
               +----------------------------------+
                                |
                         Python Scripts
                      (LLM tagging, PDF parsing)
```

### Request Flow

1. Client sends request to `https://regailator.com/api/v1/...`
2. Nginx proxies `/api/` to Node.js on port 3000
3. Express middleware chain: helmet -> CORS -> auth (JWT/Passport) -> route handler
4. Controller calls service layer -> service interacts with MongoDB via Mongoose
5. Response sent back through the chain

### Real-time Email Flow

1. IMAP listener monitors inbox for new supplier emails
2. Incoming emails are parsed and matched to users/suppliers by contact email
3. AI (OpenAI) generates tags and suggested replies
4. Feedback is stored on the matched supplier subdocument
5. WebSocket pushes notification to connected frontend clients

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4.x |
| Database | MongoDB 7.x + Mongoose 5.x |
| Auth | JWT + Passport.js |
| Email (send) | Nodemailer (SMTP/Gmail) |
| Email (receive) | IMAP (node-imap) |
| Real-time | Socket.io |
| AI/LLM | OpenAI API (o1-preview) |
| PDF Parsing | Python (PyMuPDF, pytesseract) |
| Process Manager | PM2 |
| Reverse Proxy | Nginx + Let's Encrypt SSL |

## Project Structure

```
src/
 |-- configs/          # App configuration (env, JWT, roles, CORS, logging)
 |-- controllers/      # Route handlers - parse request, call services, send response
 |-- middlewares/       # Auth, error handling, rate limiting, validation
 |-- models/           # Mongoose schemas and models
 |   |-- plugins/      # Mongoose plugins (pagination, toJSON)
 |   |-- user.model.js # Main model with embedded suppliers/surveys/feedback
 |   |-- video.model.js
 |   |-- videoGroup.model.js
 |   |-- material.model.js
 |   |-- token.model.js
 |   |-- watchLog.model.js
 |   +-- errorLog.model.js
 |-- routes/v1/        # API route definitions with validation
 |-- services/         # Business logic layer (DB operations, email, auth)
 |-- utils/            # Helpers (error class, file ops, async wrapper)
 |-- validations/      # Joi validation schemas for each route
 |-- python/           # AI/LLM scripts for tagging and PDF parsing
 |   |-- gen_tags.py       # Entry point for email tagging
 |   |-- parse_files.py    # Entry point for PDF compliance extraction
 |   +-- src/              # Python modules (llm, parse, adaptor, test)
 |-- app.js            # Express app setup (middleware, routes, error handling)
 +-- index.js          # Server entry point (HTTP, Socket.io, MongoDB, IMAP)
```

## Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB >= 6
- Python 3.8+ (for AI features)
- PM2 (installed globally or via npx)

### Installation

```bash
# Clone the repository
git clone git@github.com:yil384/RegAIlator_backtend.git
cd RegAIlator_backtend

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r src/python/requirements.txt

# Set up the OpenAI API key for AI features
echo "sk-proj-your-key-here" > src/python/include/openai_key.in

# Copy environment config
cp .env.example .env
# Edit .env with your settings (see Environment Variables below)

# Development mode (with hot reload)
npm run dev

# Production mode (with PM2)
npm start
```

### Quick Verification

```bash
# Check if the server is running
curl http://localhost:3000/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

## Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=production

# MongoDB
MONGODB_URL=mongodb://127.0.0.1:27017/regailator

# JWT Authentication
JWT_SECRET=your-secret-key-here
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30
JWT_RESET_PASSWORD_EXPIRATION_MINUTES=10
JWT_VERIFY_EMAIL_EXPIRATION_MINUTES=10

# SMTP (outbound email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# IMAP (inbound email listener)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993

# Frontend URL (for email verification/reset links)
WEB_HOST=https://regailator.com
```

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/register` | Register new user | No |
| POST | `/api/v1/auth/login` | Login (returns JWT tokens) | No |
| POST | `/api/v1/auth/logout` | Logout (invalidate refresh token) | Yes |
| POST | `/api/v1/auth/refresh-tokens` | Refresh access token | No |
| POST | `/api/v1/auth/forgot-password` | Send password reset email | No |
| POST | `/api/v1/auth/reset-password` | Reset password with token | No |
| POST | `/api/v1/auth/verify-email` | Verify email with token | No |

### Suppliers (per-user)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/auth/my-suppliers` | Get current user's suppliers | Yes |
| POST | `/api/v1/auth/my-suppliers` | Add a supplier | Yes |
| PUT | `/api/v1/auth/my-suppliers/:supplierId` | Update a supplier | Yes |
| DELETE | `/api/v1/auth/my-suppliers` | Delete suppliers by IDs | Yes |
| POST | `/api/v1/auth/my-suppliers-batch` | Batch import suppliers | Yes |

### Surveys (per-user)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/auth/my-surveys` | Get current user's survey templates | Yes |
| POST | `/api/v1/auth/my-surveys` | Create a survey template | Yes |
| PUT | `/api/v1/auth/my-surveys/:surveyId` | Update a survey template | Yes |
| DELETE | `/api/v1/auth/my-surveys` | Delete surveys by IDs | Yes |

### Email

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/send-mention-email` | Send survey email to supplier | Yes |
| POST | `/api/v1/auth/send-reply-email` | Send reply to supplier email | Yes |

### Files & Videos

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/videos/upload_file/:supplierId` | Upload compliance documents | Yes |
| POST | `/api/v1/videos/parse` | Parse uploaded PDFs with AI | Yes |
| GET | `/api/v1/videos` | List all videos/files | Yes |

### Users (admin)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/users` | List all users | Admin |
| POST | `/api/v1/users` | Create a user | Admin |
| PATCH | `/api/v1/users/:userId` | Update a user | Admin |
| DELETE | `/api/v1/users/:userId` | Delete a user | Admin |

## Data Model

### Core Entity Relationship

```
User
 |-- suppliers[] (embedded subdocuments)
 |   |-- supplierName, contact, status
 |   |-- rawMaterials[] (material name, part number)
 |   |-- chooseSurvey (ObjectId -> surveys[]._id)
 |   |-- feedback[] (email replies from suppliers)
 |   |   |-- from, to, subject, content, date
 |   |   |-- attachments[]
 |   |   |-- tags[] (AI-generated)
 |   |   |-- reply { subject, content } (AI-suggested)
 |   |   +-- surveyId
 |   +-- nextEmailSendTime, isEmailSent
 |-- surveys[] (embedded subdocuments)
 |   |-- title, html, json, revision
 |   +-- attachments[]
 +-- email, password, role, firstname, lastname

Video (standalone collection)
 |-- title, path, json (parsed compliance data)
 |-- addedBy -> User, supplier -> Supplier
 +-- group -> VideoGroup

Material (standalone collection - Bill of Materials)
 |-- materialName, partNumber, factoryName
 |-- rawMaterialName, supplier
 +-- user -> User
```

**Why embedded subdocuments?** Suppliers, surveys, and feedback are always accessed in the context of a specific user. Embedding avoids expensive joins and ensures atomic updates. The trade-off is a larger user document, but typical users have <200 suppliers.

## Email Processing Pipeline

```
Incoming Email (IMAP)
        |
        v
  1. Parse with mailparser (extract from/to/cc/subject/body/attachments)
        |
        v
  2. Match to user/supplier:
     a. Check CC field against user emails
     b. Check sender against supplier contacts
     c. Check email body for supplier contact emails
        |
        v
  3. Save attachments to /attachments/ directory
        |
        v
  4. Run AI tagging (Python gen_tags.py):
     - Input: email text + PDF/XLSX attachments
     - Output: tags[] + suggested reply { subject, content }
        |
        v
  5. Store feedback on matched supplier subdocument
        |
        v
  6. Push notification to frontend via Socket.io
```

## AI/LLM Integration

The platform uses OpenAI's API for two key features:

### 1. Email Tagging (`gen_tags.py`)

Analyzes supplier email responses to extract compliance tags (e.g., "no PFAS", "compliant", "requires review") and generates suggested reply drafts.

- **Input**: Email text content + optional PDF/XLSX attachments
- **Output**: JSON with `tags[]` and `reply { subject, content }`
- **Quick-match**: Common responses like "no PFAS" or "no info" are handled without LLM calls

### 2. PDF Compliance Parsing (`parse_files.py`)

Extracts structured compliance data from regulatory PDF documents.

- **Input**: PDF file path
- **Output**: JSON with structured fields (Date, Vendor, Product, Regulation, CAS numbers, Concentrations, etc.)
- **OCR fallback**: If PDF has no embedded text, falls back to pytesseract OCR

### Configuration

Place your OpenAI API key in `src/python/include/openai_key.in`. Prompt templates are in `src/python/include/prompt/` and `src/python/include/prompt_tags/`.

## Deployment

### Production Setup (current)

```
Ubuntu Server (AWS EC2)
 |-- Nginx (port 80/443, SSL via Let's Encrypt)
 |   |-- / -> /var/www/html (React frontend build)
 |   |-- /api/ -> proxy to localhost:3000
 |   +-- /socket.io/ -> proxy to localhost:3000
 |-- PM2 (process manager)
 |   +-- app (fork mode, auto-restart)
 +-- MongoDB (localhost:27017)
```

### SSL Certificate

Managed by Certbot (auto-renewal via cron on the 1st of each month):

```bash
# Manual renewal
sudo certbot renew --force-renewal

# Check certificate status
sudo certbot certificates
```

### PM2 Commands

```bash
# Start
npm start

# Restart
npx pm2 restart app

# View logs
npx pm2 logs app

# Monitor resources
npx pm2 monit

# View process info
npx pm2 info app
```

## Development Guide

### Adding a New API Endpoint

1. **Define validation** in `src/validations/` using Joi
2. **Create/update route** in `src/routes/v1/` with auth and validate middleware
3. **Add controller** in `src/controllers/` using `catchAsync` wrapper
4. **Add service logic** in `src/services/` for database operations
5. **Update model** in `src/models/` if new fields needed

### Error Handling

- All async controller functions must be wrapped with `catchAsync()`
- Throw `ApiError` for expected errors (404, 400, 403)
- Unexpected errors are caught by the global error handler in `src/middlewares/error.js`
- In production, only operational errors show detailed messages; others return generic 500

### Authentication Flow

```
Login -> JWT access token (30min) + refresh token (30 days)
    |
    v
Request with: Authorization: Bearer <access_token>
    |
    v
Passport JWT strategy verifies token -> attaches user to req.user
    |
    v
auth() middleware checks required rights against user role
```

### Role-Based Access Control

| Role | Permissions |
|------|------------|
| `admin` | Full access to all resources |
| `user` | Access to own suppliers, videos, surveys |
| `guest` | No permissions (newly registered) |

### Key Conventions

- **Services** handle all database logic; controllers only parse requests and send responses
- **Validation** happens at the route level via Joi schemas before reaching controllers
- Supplier and survey data are **embedded subdocuments** within the User model
- File uploads go to `/uploads/` directory, served via Nginx at `/api/uploads/`
- Email attachments go to `/attachments/` directory, served at `/api/attachments/`

## License

MIT
