# 🔧 Complete Fix Guide for Vercel 500 Errors

## 🎯 Critical Steps to Fix Your Live Deployment

### Step 1: Add Environment Variables to Vercel Dashboard

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these variables:

```
DATABASE_URL=postgresql://neondb_owner:npg_s98QCkESmFJY@ep-withered-unit-adnn2zrd-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

NODE_ENV=production

PG_MAX_POOL=20

PG_IDLE_TIMEOUT=30000

PG_CONNECTION_TIMEOUT=15000

PG_PREPARE=false

ADMIN_SECRET=JRhnK7bMgBtLwzA8myrZIY5UN219DofF
```

⚠️ **Important:** These variables must be set in **Vercel**, NOT in `.env` file (which is ignored in production)

### Step 2: Verify Vercel Configuration

The `vercel.json` file now includes:
```json
{
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "dist/spa",
  "functions": {
    "api/**/*.js": {
      "includeFiles": "server/**"
    }
  }
}
```

This ensures the `server/` directory is bundled with your API functions.

### Step 3: Redeploy

After adding environment variables:
1. Go to Vercel Dashboard → Your Project
2. Click **"Redeploy"** button (or push a commit to GitHub)
3. Wait for deployment to complete (Status should show "Ready")

### Step 4: Test the Endpoints

Once deployed, test in your browser console:

```javascript
// Create a room
fetch('https://your-app.vercel.app/api/admin/create-room', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'TEST', title: 'Test Room', durationMinutes: 30 })
}).then(r => r.json()).then(console.log);

// Get admin state
fetch('https://your-app.vercel.app/api/admin/state?room=TEST')
  .then(r => r.json()).then(console.log);

// Login team
fetch('https://your-app.vercel.app/api/game/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ room_code: 'TEST', team_name: 'Team1' })
}).then(r => r.json()).then(console.log);
```

---

## 🐛 Debugging 500 Errors

If you still see 500 errors, follow these steps:

### Check Vercel Runtime Logs

1. Go to **Vercel Dashboard** → Your Project → **Deployments**
2. Click on the latest deployment
3. Click on **"Functions"** tab
4. Click on `/api/admin/[...slug]` (or the failing endpoint)
5. Click **"View Logs"** 
6. Look for error messages

### Common Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot find module '../../server/db.ts'` | Wrong import extension | Already fixed - using `.js` |
| `getaddrinfo ENOTFOUND ep-withered-unit...` | Wrong DATABASE_URL | Check Neon connection string |
| `Authentication timed out` | Connection timeout | Already fixed - 15s timeout |
| `read ECONNRESET` | Pool exhausted | Already fixed - pool size 20 |
| `undefined is not a function` | Missing db import | Check imports use `.js` |

---

## ✅ Verification Checklist

- [ ] Environment variables added to Vercel (not `.env` file)
- [ ] DATABASE_URL is correct for your Neon account
- [ ] Vercel deployment completed successfully (status: "Ready")
- [ ] API endpoints respond (check browser console for errors)
- [ ] Can create room: `POST /api/admin/create-room`
- [ ] Can get admin state: `GET /api/admin/state?room=DEMO`
- [ ] Can login team: `POST /api/game/login`
- [ ] Can get leaderboard: `GET /api/leaderboard?room=DEMO`

---

## 🚀 Full Feature Testing

Once errors are fixed, test the complete flow:

1. **Create a Room (Admin)**
   - Go to your app → Admin page
   - Enter room code: `DEMO`
   - Click "Create Room"

2. **Add Questions (Admin)**
   - Stay on Admin page
   - Upload CSV file with questions
   - Or manually add questions

3. **Start Game (Admin)**
   - Click "Start Game"
   - Set timer (e.g., 10 minutes)

4. **Join Team (Game)**
   - Open new browser tab
   - Go to your app → Game page
   - Enter room: `DEMO`
   - Enter team name: `Team 1`
   - Click "Join"

5. **Play Game**
   - Click on questions in the grid
   - Select answers
   - Try to complete bingo

6. **View Leaderboard**
   - Click "Leaderboard" button
   - See team rankings
   - Check for winner celebration

---

## 📊 Performance Monitoring

After fixing:

1. **Monitor Vercel Functions**
   - Vercel Dashboard → Analytics
   - Check function duration (should be <500ms)
   - Monitor for errors

2. **Check Database Performance**
   - Neon Console → Monitoring
   - Look for slow queries
   - Check connection pool usage

---

## 🆘 Still Having Issues?

### Check These in Order:

1. **Vercel Environment Variables**
   ```
   - DATABASE_URL is set? ✓
   - NODE_ENV=production? ✓
   - All PG_* variables set? ✓
   ```

2. **Deployment Status**
   ```
   - Deployment status = "Ready"? ✓
   - No build errors in logs? ✓
   - Redeployed after adding env vars? ✓
   ```

3. **Database Connection**
   ```
   - Neon account active? ✓
   - Connection string format correct? ✓
   - Can connect locally with same string? ✓
   ```

4. **API Code**
   ```
   - Imports use .js not .ts? ✓
   - All handlers exported? ✓
   - Error handling in place? ✓
   ```

### Getting Help

If still stuck:
1. Check VERCEL-FIX-GUIDE.md in repository
2. Look at Vercel Runtime Logs for specific error
3. Test locally: `npm run dev`
4. Verify DATABASE_URL: `echo $DATABASE_URL`

---

## 📝 Code Changes Made

### Files Modified:

1. **vercel.json** - Added functions configuration
2. **server/db.ts** - Improved connection pooling  
3. **.env.example** - Updated with recommended settings
4. **api/admin/[...slug].js** - Enhanced error logging
5. **api/game/[...slug].js** - Fixed imports to use `.js`
6. **api/leaderboard/[...slug].js** - Added logging

### Key Improvements:

✅ Fixed TypeScript imports in JavaScript files
✅ Added server files to Vercel function bundle
✅ Improved database connection configuration
✅ Enhanced error messages for debugging
✅ Added comprehensive troubleshooting guide
✅ All tests passing
✅ Build verified working

---

## 🎉 Success Indicators

When everything is working:
- ✅ Admin panel loads without errors
- ✅ Can create rooms
- ✅ Can add questions (text or CSV)
- ✅ Can start game with timer
- ✅ Players can join and play
- ✅ Leaderboard updates in real-time
- ✅ Winner celebration displays
- ✅ No 404 or 500 errors

**Your Bingo Platform is ready for production! 🎉**
