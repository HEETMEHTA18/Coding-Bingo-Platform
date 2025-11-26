# 🎮 Coding Bingo Platform - Complete Guide

Welcome to the **Coding Bingo Platform**, a comprehensive suite of multiplayer coding games designed to test your programming skills, logic, and teamwork. This guide provides an overview of all available game modes and features.

![Coding Bingo Interface](./assets/images/coding_bingo_interface_1764177835362.png)

## 🌟 Introduction

The Coding Bingo Platform is a real-time multiplayer environment where teams compete in various coding-themed challenges. Whether you're debugging code against the clock, solving logic puzzles, or competing in a classic game of Connect 4 with a twist, there's something for every coder.

## 🕹️ Game Modes

### 1. Coding Bingo (Flagship Game)
The core experience of the platform. Teams solve coding problems to claim spots on a 5x5 grid.
- **Objective:** Complete a row, column, or diagonal (Bingo) or fill the entire grid.
- **Mechanics:** Correct answers fill random spots. "Fake" questions test your knowledge without filling the grid.
- **Visuals:** Split-screen view with code editor and live bingo grid.

![Coding Bingo](./assets/images/coding_bingo_interface_1764177835362.png)

### 2. Speed Coding Race
A high-octane race against other teams to fix buggy code.
- **Objective:** Fix syntax and logic errors in the provided code snippets as fast as possible.
- **Mechanics:** Real-time progress bar shows your standing against other teams.
- **Visuals:** Dark-themed editor with diff-view capabilities and live race status.

![Speed Coding Race](./assets/images/speed_coding_race_interface_1764177880806.png)

### 3. Code Canvas
Unleash your creativity by drawing with code.
- **Objective:** Create pixel art or patterns using code commands.
- **Mechanics:** Use a custom API to draw on the canvas. Best designs win!
- **Visuals:** Large canvas area with a command palette and color picker.

![Code Canvas](./assets/images/code_canvas_interface_1764177958866.png)

### 4. Memory Match
Test your memory and code knowledge.
- **Objective:** Match pairs of cards. Pairs can be `Code <-> Output`, `Concept <-> Definition`, or identical symbols.
- **Mechanics:** Turn-based or time-attack modes.
- **Visuals:** Grid of flip-cards with coding symbols.

![Memory Match](./assets/images/memory_match_interface_1764177993590.png)

### 5. Connect 4 (Coder's Edition)
The classic strategy game reimagined.
- **Objective:** Connect 4 discs in a row.
- **Mechanics:** To drop a disc, you must answer a quick coding question correctly.
- **Visuals:** Vertical game board with neon-styled discs.

![Connect 4](./assets/images/connect4_interface_1764178020699.png)

### 6. Sudoku
Logic puzzle for the analytical mind.
- **Objective:** Fill the 9x9 grid so that each column, row, and 3x3 box contains all digits from 1 to 9.
- **Mechanics:** Standard Sudoku rules, with a coding twist (hexadecimal mode available).
- **Visuals:** Clean, minimalist grid with helper tools.

![Sudoku](./assets/images/sudoku_interface_1764178039755.png)

### 7. Coding Crossword
Test your terminology.
- **Objective:** Fill the crossword grid with programming terms based on clues.
- **Mechanics:** Clues cover languages, algorithms, and computer science history.
- **Visuals:** Classic crossword layout with a modern dark theme.

![Crossword](./assets/images/crossword_interface_1764178082222.png)

### 8. Tech Quiz & Puzzle Hunt
- **Tech Quiz:** Fast-paced multiple choice questions to test broad knowledge.
- **Puzzle Hunt:** A series of cryptic logic puzzles and riddles that require out-of-the-box thinking.

## 🛠️ Admin Panel Guide

The Admin Panel is the control center for the platform.

1.  **Access:** Navigate to `/admin`.
2.  **Create Room:** Enter a unique Room Code, Title, and select the Game Type.
3.  **Manage Questions:** Upload questions via CSV or add them manually.
4.  **Control Game:** Start, pause, or force-end games. Monitor the live leaderboard.

## 🚀 Installation & Deployment

For detailed instructions on how to deploy this platform to production (Railway, VPS, etc.), please refer to the **[DEPLOYMENT.md](./DEPLOYMENT.md)** file.

### Quick Start (Local)

```bash
# Install dependencies
npm install

# Setup Database
# (Ensure .env is configured with DATABASE_URL)
npm run migrate

# Start Server
npm run dev
```

Visit `http://localhost:5173` to start playing!

---

*Built with ❤️ for the developer community.*
