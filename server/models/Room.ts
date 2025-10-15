import { db } from "../db";
import { rooms } from "../schema";
import { eq } from "drizzle-orm";
import type { RoomCode, Room as RoomType } from "@shared/api";

export class RoomModel {
  static async create(code: RoomCode, title: string, roundEndAt: number | null = null): Promise<RoomType> {
    const dbRoundEndAt = roundEndAt ? new Date(roundEndAt) : null;
    await db.insert(rooms).values({
      code,
      title,
      roundEndAt: dbRoundEndAt,
    }).onConflictDoNothing();
    return { code, title, roundEndAt };
  }

  static async findByCode(code: RoomCode): Promise<RoomType | null> {
    const result = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (result.length === 0) return null;
    const row = result[0];
    return {
      code: row.code,
      title: row.title,
      roundEndAt: row.roundEndAt ? row.roundEndAt.getTime() : null,
    };
  }

  static async update(code: RoomCode, updates: Partial<RoomType>): Promise<RoomType | null> {
    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.roundEndAt !== undefined) updateData.roundEndAt = updates.roundEndAt ? new Date(updates.roundEndAt) : null;

    await db.update(rooms).set(updateData).where(eq(rooms.code, code));
    return this.findByCode(code);
  }

  static async exists(code: RoomCode): Promise<boolean> {
    const result = await db.select({ count: rooms.code }).from(rooms).where(eq(rooms.code, code)).limit(1);
    return result.length > 0;
  }

  static async getAll(): Promise<RoomType[]> {
    const result = await db.select().from(rooms);
    return result.map(row => ({
      code: row.code,
      title: row.title,
      roundEndAt: row.roundEndAt ? row.roundEndAt.getTime() : null,
    }));
  }

  static async extendTimer(code: RoomCode, minutes: number): Promise<RoomType | null> {
    const room = await this.findByCode(code);
    if (!room) return null;

    const now = Date.now();
    const base = room.roundEndAt && room.roundEndAt > now ? room.roundEndAt : now;
    const newEndAt = base + minutes * 60 * 1000;

    return this.update(code, { roundEndAt: newEndAt });
  }

  static async forceEnd(code: RoomCode): Promise<RoomType | null> {
    return this.update(code, { roundEndAt: Date.now() });
  }
}
