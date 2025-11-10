// Game Router - Dynamically loads correct game component based on room's gameType

import { useEffect, useState } from "react";
import type { Room } from "@shared/api";
import GamePage from "./Game"; // Bingo game
import SudokuGame from "./games/SudokuGame";
import Connect4Game from "./games/Connect4Game";
import MemoryGame from "./games/MemoryGame";
import RaceGame from "./games/RaceGame";
import CrosswordGame from "./games/CrosswordGame";

function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    if (raw === "undefined" || raw === "null") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function GameRouter() {
  // Set DEBUG=true during local debugging; keep false in production to avoid console spam
  const DEBUG = false;
  const dbg = (...args: any[]) => DEBUG && console.log(...args);
  const [room, setRoom] = useState<Room | null>(safeParse<Room>(localStorage.getItem("bingo.room")));
  const [gameType, setGameType] = useState<string>("bingo");

  useEffect(() => {
    // Listen for room updates and validate data consistency
    const checkRoom = () => {
      const storedRoom = safeParse<Room>(localStorage.getItem("bingo.room"));
      const storedTeam = safeParse<{ team_id?: string; id?: string }>(localStorage.getItem("bingo.team"));
      
      if (storedRoom && storedTeam) {
        // Validate that team and room data is consistent
        const teamId = storedTeam.team_id || storedTeam.id;
        if (!teamId) {
          console.warn("⚠️ Invalid team data detected, clearing localStorage");
          localStorage.removeItem("bingo.team");
          localStorage.removeItem("bingo.room");
          window.location.href = "/";
          return;
        }
        
        setRoom(storedRoom);
        const type = storedRoom.gameType || "bingo";
  dbg("🎮 GameRouter - Room detected:", storedRoom.code, "Type:", type, "Team ID:", teamId);
        setGameType(type);
      } else if (storedRoom || storedTeam) {
        // Partial data detected - clear everything to prevent conflicts
        console.warn("⚠️ Mismatched team/room data detected, clearing localStorage");
        localStorage.removeItem("bingo.team");
        localStorage.removeItem("bingo.room");
        window.location.href = "/";
      }
    };

    checkRoom();
    const interval = setInterval(checkRoom, 2000);
    return () => clearInterval(interval);
  }, []);


  // Route to correct game component based on gameType
  switch (gameType) {
    case "sudoku":
      return <SudokuGame />;
    case "connect4":
      return <Connect4Game />;
    case "memory":
      return <MemoryGame />;
    case "race":
      return <RaceGame />;
    case "crossword":
      return <CrosswordGame />;
    case "bingo":
    default:
      return <GamePage />;
  }
}
