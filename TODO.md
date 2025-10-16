# TODO: Fix Congratulations and Leaderboard Flow

## Tasks
- [x] Edit client/pages/Congratulations.tsx: Add loading state, remove Home button, use navigate with state for View Leaderboard
- [x] Edit client/pages/Leaderboard.tsx: Add logic to check fromCongratulations state and game completion, hide Back to Game button accordingly

## Followup Steps
- [ ] Test congratulations page shows loading then directly congratulations without Access Denied
- [ ] Test navigation to leaderboard from congratulations hides Back to Game button
- [ ] Ensure no other flows are broken
