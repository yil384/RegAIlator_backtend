# RegAIlator Backend - TODO / Roadmap

> Last updated: 2026-04-08

---

## High Priority

### 1. Frontend Full Rename Migration
The backend has been fully renamed (video -> document, videoGroup -> documentGroup, watchLog -> auditLog), but the frontend still has legacy directory and file names:
- `src/views/videos/` -> rename to `src/views/documents/`
- `src/views/video-group/` -> rename to `src/views/document-groups/`
- `src/views/watch-logs/` -> rename to `src/views/audit-logs/`
- Redux files: `actionTypes`, `actions`, `reducers`, `sagas` in each view folder still use old names (e.g. `video-groups.actionTypes.js`)
- Route definitions in `src/routes/MainRoutes.js` and menu items in `src/menu-items/`
- After all frontend files are renamed, remove the backwards-compatible aliases from:
  - `src/configs/endpoints.js` (the `videoGroups`, `videos`, `watchLogs` aliases)
  - Each helper file's aliased exports (e.g. `fetchDocuments as fetchVideos`)
- After frontend is fully migrated, remove the backend's backwards-compatible route aliases in `src/routes/v1/index.js` (`/videos`, `/video-groups`, `/watch-logs`)

### 2. Rebuild & Redeploy Frontend
The server at `/var/www/html/` is running an older frontend build. After any frontend change:
```bash
# Build locally (server has limited RAM, builds crash on server)
npm run build
# Upload the build/ folder to server
scp -r build/* ubuntu@regailator.com:/var/www/html/
```

### 3. Upgrade Mongoose 5 -> 7+
Currently on `mongoose@5.13.22` (EOL). Upgrade path:
- `.remove()` calls are already replaced with `.deleteOne()` (done)
- Review `Model.find()` callback usage -> all should be promise-based (mostly done)
- Check `Query.exec()` behavior changes
- Test subdocument operations (`user.suppliers.id().remove()` still used in user.service.js)
- Update connection options (many v5 options deprecated in v7)

### 4. Upgrade Express 4 -> 5
Currently on `express@4.17.1`. Express 5 has breaking changes:
- `res.json()` / `res.send()` behavior changes
- Path route matching changes
- Removed deprecated methods

---

## Medium Priority

### 5. Add Automated Tests
No test suite exists. Priority areas:
- Auth flow: register, login, token refresh, password reset
- Supplier CRUD (embedded subdocument operations)
- Survey CRUD and email sending
- Document upload and file management
- Email listener parsing (IMAP reply processing)
- Use Jest + Supertest with a test MongoDB instance

### 6. Add Request Validation for Supplier/Survey Endpoints
The `/auth/my-suppliers`, `/auth/my-surveys` routes go through `auth.route.js` but lack Joi validation schemas. Add validation for:
- POST/PUT supplier body (supplierName, contact, chooseSurvey, etc.)
- POST/PUT survey body (title, html, attachments)
- Batch operations (suppliersBatch, billOfMaterialsBatchAdd)

### 7. Upgrade Security Dependencies
Several packages are on older major versions:
- `helmet@4` -> `helmet@7+`
- `express-rate-limit@5` -> `express-rate-limit@7+`
- `passport@0.4` -> `passport@0.7+`
- `jsonwebtoken@8` -> `jsonwebtoken@9+`
- `bcryptjs@2` -> verify latest
- `xss-clean@0.1.1` -> this package is unmaintained, consider replacing with `express-xss-sanitizer`
- Remove `fluent-ffmpeg` (legacy video dependency, no longer needed)

### 8. Database Field Rename: `videoGroupId`
The `auditLog.model.js` still has a field named `videoGroupId` for MongoDB backwards compatibility. Plan a migration:
1. Add new field `documentGroupId` to the schema
2. Write a migration script to copy `videoGroupId` -> `documentGroupId` for all documents
3. Update all code references
4. Drop the old field

### 9. Separate Supplier/Survey Routes from Auth
Supplier and survey CRUD operations are currently routed through `auth.route.js` (e.g. `/auth/my-suppliers`). These should be separate route files:
- `/suppliers` -> `supplier.route.js`
- `/surveys` -> `survey.route.js`
- `/bill-of-materials` -> `material.route.js`
This improves code organization and makes the API more RESTful.

### 10. GitHub Actions CI/CD for Backend
The frontend has a GitHub Actions deploy workflow. Add one for the backend:
- Run linting on PR
- Run tests (once they exist)
- Auto-deploy on push to main (SSH into server, `git pull && pm2 restart app`)

---

## Low Priority

### 11. Replace Embedded Subdocuments with Separate Collections
Current architecture embeds suppliers[] and surveys[] inside the User document. This works but has limits:
- MongoDB 16MB document size limit
- Every supplier update loads the entire user document
- Can't query suppliers independently (e.g. "find all suppliers with status X across all users")
Consider migrating to separate Supplier and Survey collections with `userId` references when the data grows.

### 12. Add Rate Limiting Per Route
Global rate limiting exists, but consider per-route limits:
- Stricter limits on `/auth/login` (prevent brute force)
- Stricter limits on `/auth/forgot-password`
- Relaxed limits on read-only GET endpoints

### 13. Add API Documentation
Swagger/OpenAPI is set up (`swagger-jsdoc`, `swagger-ui-express`) but routes lack JSDoc annotations. Add `@swagger` comments to all route files so `/api/v1/docs` is useful.

### 14. Clean Up Python AI Integration
The `src/python/` directory contains AI/LLM scripts for email tagging and PDF parsing. Review and improve:
- Error handling for OpenAI API failures
- API key management (currently in `include/openai_key.in`)
- Consider moving to Node.js OpenAI SDK to eliminate Python dependency

### 15. Add WebSocket Authentication
Socket.IO connections currently have no auth. Add JWT verification on connection:
```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // verify JWT before allowing connection
});
```

### 16. Logging Improvements
- Add request ID tracking across logs for debugging
- Add structured JSON log format for production (already using Winston)
- Set up log rotation for PM2 logs (`pm2 install pm2-logrotate`)

---

## Infrastructure Notes

- **Server**: 2 CPUs, 3.8GB RAM + 2GB swap (`/swapfile`)
- **Process manager**: PM2 in fork mode, auto-starts on reboot via systemd (`pm2-ubuntu.service`)
- **Reverse proxy**: Nginx with Let's Encrypt SSL
- **Frontend builds**: Must be done locally due to limited server RAM, then uploaded to `/var/www/html/`
- **MongoDB**: Collection names preserved during rename (`videos`, `videogroups`, `watchlogs`) - no data migration needed
