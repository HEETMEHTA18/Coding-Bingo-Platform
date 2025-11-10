// LocalStorage utilities for game data management

import type { Team, Room } from "@shared/api";

/**
 * Safely parse JSON from localStorage
 */
export function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    if (raw === "undefined" || raw === "null") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Clear all game-related localStorage data
 */
export function clearGameData(): void {
  localStorage.removeItem("bingo.team");
  localStorage.removeItem("bingo.room");
  localStorage.removeItem("bingo.admin");
  console.log("🧹 Cleared all game data from localStorage");
}

/**
 * Validate that team and room data exists and is consistent
 * Returns true if valid, false otherwise
 */
export function validateGameData(): { valid: boolean; team: Team | null; room: Room | null } {
  const team = safeParse<Team>(localStorage.getItem("bingo.team"));
  const room = safeParse<Room>(localStorage.getItem("bingo.room"));

  // Both must exist
  if (!team || !room) {
    console.warn("⚠️ Missing team or room data");
    return { valid: false, team: null, room: null };
  }

  // Team must have a valid ID
  const teamId = team.team_id || team.id;
  if (!teamId) {
    console.warn("⚠️ Team missing ID");
    return { valid: false, team: null, room: null };
  }

  // Room must have a code
  if (!room.code) {
    console.warn("⚠️ Room missing code");
    return { valid: false, team: null, room: null };
  }

  return { valid: true, team, room };
}

/**
 * Store team and room data in localStorage
 */
export function saveGameData(team: Team, room: Room): void {
  localStorage.setItem("bingo.team", JSON.stringify(team));
  localStorage.setItem("bingo.room", JSON.stringify(room));
  console.log("💾 Saved game data - Team:", team.team_id || team.id, "Room:", room.code);
}

/**
 * Check if user is admin
 */
export function isAdmin(): boolean {
  return localStorage.getItem("bingo.admin") === "true";
}

/**
 * Set admin status
 */
export function setAdmin(value: boolean): void {
  if (value) {
    localStorage.setItem("bingo.admin", "true");
  } else {
    localStorage.removeItem("bingo.admin");
  }
}
