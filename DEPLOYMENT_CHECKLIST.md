# 🚀 Deployment Checklist

## Pre-Deployment Tasks

### 1. Database Migration ⚠️ **REQUIRED**
```bash
node scripts/run-migration.mjs
```

**Verify**:
- [ ] `game_type` column added to `rooms` table
- [ ] `game_boards` table created
- [ ] `game_moves` table created
- [ ] All indexes created successfully

---

### 2. Environment Variables
Verify these are set in production:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NODE_ENV=production
PORT=8080
```

- [ ] `DATABASE_URL` is correct
- [ ] `NODE_ENV=production`
- [ ] Port is configured (default: 8080)

---

### 3. Build Verification
```bash
npm run build
```

**Expected**:
- [ ] ✅ Client build successful (~795 KB)
- [ ] ✅ Server build successful (~53 KB)
- [ ] ✅ No errors in console
- [ ] Files exist in `dist/spa/` and `dist/server/`

---

## Manual Testing (5-10 minutes)

### Test 1: Admin Panel
1. [ ] Login as admin (`ADMINLOGIN` / `HELLOWORLD@123`)
2. [ ] Click "Create New Room"
3. [ ] Verify dropdown shows all 6 game types:
   - Bingo 🎯
   - Sudoku 🧩
   - Memory Match 🧠
   - Connect-4 🔴
   - Race (Coming Soon) 🏁
   - Crossword (Coming Soon) 📝
4. [ ] Create a **Sudoku** room (e.g., `TEST01`)
5. [ ] Create a **Memory** room (e.g., `TEST02`)
6. [ ] Create a **Connect4** room (e.g., `TEST03`)

---

### Test 2: Sudoku Game
1. [ ] Open new incognito window
2. [ ] Login: Team 1 → Room `TEST01`
3. [ ] Verify Sudoku grid loads
4. [ ] Click "Answer Question" button
5. [ ] Answer a question correctly
6. [ ] Verify keyword is unlocked
7. [ ] Place keyword in grid
8. [ ] Check console (should be **clean**, no spam)
9. [ ] Use Hint button
10. [ ] Verify hint reveals a correct cell

---

### Test 3: Memory Game
1. [ ] Open new incognito window
2. [ ] Login: Team 2 → Room `TEST02`
3. [ ] Verify 12-card grid loads
4. [ ] Click 2 cards to flip
5. [ ] Match a pair correctly
6. [ ] Answer a question to unlock power-up
7. [ ] Use "Peek" power-up (👀)
   - All cards should reveal for 2 seconds
8. [ ] Use "Reveal" power-up (💡)
   - One pair should auto-match
9. [ ] Complete all 6 pairs
10. [ ] Verify completion message shows

---

### Test 4: Connect4 Game
1. [ ] Open new incognito window
2. [ ] Login: Team 3 → Room `TEST03`
3. [ ] Verify 7×6 grid loads
4. [ ] Drop a token in a column
5. [ ] Bot should respond with its move
6. [ ] Answer a question to unlock power-up
7. [ ] Use "Column Hint" (💡)
   - Should suggest best column
8. [ ] Use "Block Bot" (🛡️)
   - Bot should skip next turn
9. [ ] Try to win/lose a game
10. [ ] Verify winner detection works

---

### Test 5: Multi-Team & Logout
1. [ ] Login Team 4 → Room `TEST01` (Sudoku)
2. [ ] Open another window: Team 5 → Room `TEST02` (Memory)
3. [ ] Verify teams don't interfere with each other
4. [ ] Test logout from Team 4
5. [ ] Verify localStorage is cleared
6. [ ] Login again → Should work correctly

---

## Browser Console Check

Open DevTools Console and verify:
- [ ] **No errors** (red messages)
- [ ] **No excessive logging** (should be clean)
- [ ] **No CORS errors**
- [ ] **API calls return 200 OK**

---

## Post-Deployment Verification

### 1. Production URL Test
```bash
# Test API endpoint
curl https://your-app.vercel.app/api/health

# Expected: {"status": "ok"}
```

- [ ] API responds correctly
- [ ] Static files load (check Network tab)
- [ ] No 404 errors

---

### 2. Database Connection
- [ ] Check server logs for DB connection
- [ ] Verify no connection pool errors
- [ ] Test creating a room (writes to DB)
- [ ] Test loading rooms (reads from DB)

---

### 3. Multi-Device Test
- [ ] Open on desktop browser
- [ ] Open on mobile browser
- [ ] Open on tablet
- [ ] Verify responsive design works
- [ ] Test all games on each device

---

## Performance Check

### Load Times
- [ ] First load < 5 seconds
- [ ] Page transitions < 500ms
- [ ] API responses < 100ms
- [ ] No memory leaks (play for 5+ minutes)

### Bundle Sizes
- [ ] Client JS: ~795 KB (acceptable)
- [ ] Client CSS: ~129 KB (good)
- [ ] Server JS: ~53 KB (good)

---

## Rollback Plan

If critical issues found:

### Option 1: Quick Fix
```bash
# Fix the issue
git add .
git commit -m "hotfix: Critical issue"
git push origin main
```

### Option 2: Full Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to last known good commit
git reset --hard <commit-hash>
git push origin main --force
```

---

## Success Criteria

All items checked = ✅ **DEPLOY TO PRODUCTION**

**Minimum Requirements**:
- ✅ Database migration successful
- ✅ Build completes without errors
- ✅ At least 1 game tested end-to-end
- ✅ Console is clean (no spam)
- ✅ Submit API works (200 response)
- ✅ No TypeScript errors

---

## Contact & Support

**Documentation**:
- See `PRODUCTION_READY_REPORT.md` for full details
- Check `README.md` for setup instructions

**Common Issues**:
1. **Database connection fails**: Check `DATABASE_URL` env var
2. **Build errors**: Run `npm install` again
3. **Games don't load**: Check `gameType` column exists in DB
4. **Console spam**: Verify `DEBUG=false` in `GameRouter.tsx`

---

**Last Updated**: November 10, 2025  
**Status**: ✅ **READY FOR PRODUCTION DEPLOYMENT**
