-- Add indexes on foreign key columns for better query performance
-- This will dramatically speed up joins and lookups

-- Index on teams.room_code (frequently queried when loading game state)
CREATE INDEX IF NOT EXISTS idx_teams_room_code ON teams(room_code);

-- Index on questions.room_code (queried when loading questions for a room)
CREATE INDEX IF NOT EXISTS idx_questions_room_code ON questions(room_code);

-- Index on team_solved_questions.team_id (queried when checking solved questions)
CREATE INDEX IF NOT EXISTS idx_team_solved_questions_team_id ON team_solved_questions(team_id);

-- Index on team_solved_questions.question_id (queried during answer checking)
CREATE INDEX IF NOT EXISTS idx_team_solved_questions_question_id ON team_solved_questions(question_id);

-- Index on team_solved_positions.team_id (queried when checking completed lines)
CREATE INDEX IF NOT EXISTS idx_team_solved_positions_team_id ON team_solved_positions(team_id);

-- Index on team_question_mapping.team_id (heavily queried for grid mapping)
CREATE INDEX IF NOT EXISTS idx_team_question_mapping_team_id ON team_question_mapping(team_id);

-- Index on team_question_mapping.question_id (queried during mapping lookups)
CREATE INDEX IF NOT EXISTS idx_team_question_mapping_question_id ON team_question_mapping(question_id);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_team_question_mapping_team_question ON team_question_mapping(team_id, question_id);

-- Index on is_deleted columns for filtering (if not already covered by partial indexes)
CREATE INDEX IF NOT EXISTS idx_rooms_not_deleted ON rooms(code) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_teams_not_deleted ON teams(team_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_questions_not_deleted ON questions(question_id) WHERE is_deleted = false;

-- Add comment for documentation
COMMENT ON INDEX idx_teams_room_code IS 'Speeds up team lookup by room code';
COMMENT ON INDEX idx_questions_room_code IS 'Speeds up question loading for rooms';
COMMENT ON INDEX idx_team_question_mapping_team_question IS 'Composite index for team-question mapping lookups';
