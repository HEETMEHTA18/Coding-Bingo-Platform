import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createServer } from "../index";

vi.mock("../db.js", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]), // Mock to return no room found
  },
}));

describe("Middleware", () => {
  it("should not parse the body of a GET request", async () => {
    const app = createServer();
    const response = await request(app)
      .get("/api/game?room=test&team=test")
      .set("Content-Type", "application/json")
      .send("{malformed_json}");

    expect(response.status).toBe(404);
  });
});
