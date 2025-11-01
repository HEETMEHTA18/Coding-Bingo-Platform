# Vercel 500 Error Fix Guide

## Problem
Getting 500 errors on `/api/admin/*` endpoints in Vercel production deployment.

## Root Causes & Solutions

### 1. **DATABASE_URL Not Set in Vercel**
**Symptom:** Database connection fails immediately
**Fix:**
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add these variables:
  ```
  DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@YOUR_HOST/neondb?sslmode=require&channel_binding=require
  NODE_ENV=production
  PG_MAX_POOL=20
  PG_IDLE_TIMEOUT=30000
  PG_CONNECTION_TIMEOUT=15000
  PG_PREPARE=false
  ```

### 2. **Missing Server Files in Vercel Function Bundle**
**Symptom:** Module not found errors
**Fix:** Already done in `vercel.json`:
```json
{
  "functions": {
    "api/**/*.js": {
      "includeFiles": "server/**"
    }
  }
}
```

### 3. **TypeScript File Extensions in JavaScript**
**Symptom:** Import errors for `.ts` files
**Fix:** All API files should use `.js` imports:
- `from "../../server/db.js"` ✅
- `from "../../server/schema.js"` ✅
- NOT `from "../../server/db.ts"` ❌

### 4. **Connection Pool Exhaustion**
**Symptom:** Timeout errors after several requests
**Fix:**
- Reduce `PG_MAX_POOL` to 20 (was 200)
- Enable keep-alive: Already in `server/db.ts`
- Set `PG_PREPARE=false` to avoid prepared statement overhead

### 5. **SSL Certificate Issues with Neon**
**Symptom:** SSL validation fails
**Fix:** Already in `server/db.ts`:
```typescript
ssl: isNeon ? "require" : false
```

## How to Debug 500 Errors

### Check Vercel Runtime Logs
1. Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Go to "Functions" tab
4. Click on `/api/admin/[...slug]`
5. View the "Runtime Logs" for error details

### Check Environment Variables
1. Vercel Dashboard → Settings → Environment Variables
2. Verify `DATABASE_URL` is set correctly
3. Verify `NODE_ENV=production`

### Local Testing
```bash
# Set environment variables
set DATABASE_URL=postgresql://...
set NODE_ENV=development

# Run development server
npm run dev

# Test endpoints
curl http://localhost:8080/api/admin/state?room=TEST
```

## API Endpoints to Test

After fixing, test these endpoints:

### 1. Create Room
```bash
curl -X POST http://your-app.vercel.app/api/admin/create-room \
  -H "Content-Type: application/json" \
  -d '{"code":"TEST","title":"Test Room","durationMinutes":30}'
```

### 2. Get Admin State
```bash
curl http://your-app.vercel.app/api/admin/state?room=TEST
```

### 3. Login Team
```bash
curl -X POST http://your-app.vercel.app/api/game/login \
  -H "Content-Type: application/json" \
  -d '{"room_code":"TEST","team_name":"Team1"}'
```

### 4. Get Leaderboard
```bash
curl http://your-app.vercel.app/api/leaderboard?room=TEST
```

## Error Messages Explained

### "Cannot find module '../../server/db.ts'"
**Problem:** JavaScript file trying to import TypeScript with `.ts` extension
**Solution:** Change to `.js` extension

### "Authentication timed out"
**Problem:** Neon connection timeout
**Solution:** Increase `PG_CONNECTION_TIMEOUT` to 15000ms

### "read ECONNRESET"
**Problem:** Connection dropped or pool exhausted
**Solution:** Reduce pool size, check keep-alive settings

### "getaddrinfo ENOTFOUND"
**Problem:** DNS resolution failure for database host
**Solution:** Verify `DATABASE_URL` is correct, check Neon account

## Step-by-Step Fix Checklist

- [ ] Update `vercel.json` with `includeFiles` for server directory
- [ ] Add `DATABASE_URL` to Vercel Environment Variables
- [ ] Add `NODE_ENV=production` to Vercel
- [ ] Verify all API files use `.js` imports
- [ ] Test endpoints from browser console or Postman
- [ ] Check Vercel Runtime Logs for detailed errors
- [ ] Rebuild and redeploy if changes made

## Performance Optimization

After fixing errors:
- Monitor Vercel Function duration (should be <500ms)
- Check database query times
- Use Vercel Analytics for insights
- Consider adding caching for frequently accessed data

## Support Resources

- Neon Documentation: https://neon.tech/docs
- Vercel Functions: https://vercel.com/docs/functions
- PostgreSQL Connection Strings: https://www.postgresql.org/docs/current/libpq-connect-string.html
