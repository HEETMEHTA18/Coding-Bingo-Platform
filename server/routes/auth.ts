import { RequestHandler } from "express";
import { db } from "../db.js";
import { users, activityLogs, adminSessions, teams, questions as questionsTable } from "../schema.js";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";

// Helper to hash password
function hashPassword(password: string, salt?: string) {
    const s = salt || crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, s, 1000, 64, "sha512").toString("hex");
    return { hash, salt: s };
}

// Verify password
function verifyPassword(password: string, hash: string, salt: string) {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return verifyHash === hash;
}

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString("hex");
}

// Parse user agent for device info
function parseUserAgent(userAgent: string) {
    const info: any = {
        browser: "Unknown",
        os: "Unknown",
        device: "Desktop"
    };
    
    // Browser detection
    if (userAgent.includes("Chrome")) info.browser = "Chrome";
    else if (userAgent.includes("Firefox")) info.browser = "Firefox";
    else if (userAgent.includes("Safari")) info.browser = "Safari";
    else if (userAgent.includes("Edge")) info.browser = "Edge";
    
    // OS detection
    if (userAgent.includes("Windows")) info.os = "Windows";
    else if (userAgent.includes("Mac")) info.os = "macOS";
    else if (userAgent.includes("Linux")) info.os = "Linux";
    else if (userAgent.includes("Android")) info.os = "Android";
    else if (userAgent.includes("iOS") || userAgent.includes("iPhone")) info.os = "iOS";
    
    // Device type
    if (userAgent.includes("Mobile") || userAgent.includes("Android") || userAgent.includes("iPhone")) {
        info.device = "Mobile";
    } else if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
        info.device = "Tablet";
    }
    
    return info;
}

// Log activity
async function logActivity(
    action: string,
    userId?: number,
    username?: string,
    details?: any,
    req?: any
) {
    try {
        const ipAddress = req?.ip || req?.connection?.remoteAddress || "unknown";
        const userAgent = req?.headers?.["user-agent"] || "unknown";
        const deviceInfo = parseUserAgent(userAgent);
        
        await db.insert(activityLogs).values({
            userId: userId || null,
            username: username || null,
            action,
            details: details ? JSON.stringify(details) : null,
            ipAddress,
            userAgent,
            deviceInfo: JSON.stringify(deviceInfo),
        });
    } catch (err) {
        console.error("Failed to log activity:", err);
    }
}

export const handleAuthLogin: RequestHandler = async (req, res) => {
    const { username, password } = req.body;
    console.log("Login attempt for:", username);
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }

    try {
        const results = await db.select().from(users).where(eq(users.username, username));
        console.log("Found users:", results.length);
        
        if (results.length === 0) {
            await logActivity("login_failed", undefined, username, { reason: "User not found" }, req);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = results[0];
        console.log("User found:", user.username, "Role:", user.role);
        const [salt, storedHash] = user.password.split(":");

        if (!storedHash) {
            console.log("Invalid password format in DB");
            return res.status(401).json({ error: "Invalid stored password format" });
        }

        const passwordValid = verifyPassword(password, storedHash, salt);
        console.log("Password valid:", passwordValid);
        
        if (passwordValid) {
            // Create session
            const sessionToken = generateSessionToken();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            const userAgent = req.headers["user-agent"] || "unknown";
            const ipAddress = req.ip || req.connection?.remoteAddress || "unknown";
            const deviceInfo = parseUserAgent(userAgent);
            
            await db.insert(adminSessions).values({
                userId: user.id,
                sessionToken,
                ipAddress,
                userAgent,
                deviceInfo: JSON.stringify(deviceInfo),
                expiresAt,
            });
            
            await logActivity("login_success", user.id, user.username, { role: user.role }, req);
            
            return res.json({
                success: true,
                sessionToken,
                admin: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        } else {
            await logActivity("login_failed", user.id, user.username, { reason: "Wrong password" }, req);
            return res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Logout handler
export const handleAuthLogout: RequestHandler = async (req, res) => {
    const sessionToken = req.headers["x-session-token"] as string;
    
    if (sessionToken) {
        try {
            const sessions = await db.select().from(adminSessions).where(eq(adminSessions.sessionToken, sessionToken));
            if (sessions.length > 0) {
                const session = sessions[0];
                await db.update(adminSessions)
                    .set({ isActive: false })
                    .where(eq(adminSessions.sessionToken, sessionToken));
                
                const userResult = await db.select().from(users).where(eq(users.id, session.userId));
                if (userResult.length > 0) {
                    await logActivity("logout", session.userId, userResult[0].username, {}, req);
                }
            }
        } catch (err) {
            console.error("Logout error:", err);
        }
    }
    
    res.json({ success: true });
};

// Get current user info
export const handleGetCurrentUser: RequestHandler = async (req, res) => {
    const sessionToken = req.headers["x-session-token"] as string;
    
    if (!sessionToken) {
        return res.status(401).json({ error: "No session token" });
    }
    
    try {
        const sessions = await db.select().from(adminSessions)
            .where(and(
                eq(adminSessions.sessionToken, sessionToken),
                eq(adminSessions.isActive, true)
            ));
        
        if (sessions.length === 0) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }
        
        const session = sessions[0];
        if (new Date() > session.expiresAt) {
            await db.update(adminSessions)
                .set({ isActive: false })
                .where(eq(adminSessions.sessionToken, sessionToken));
            return res.status(401).json({ error: "Session expired" });
        }
        
        // Update last active
        await db.update(adminSessions)
            .set({ lastActiveAt: new Date() })
            .where(eq(adminSessions.sessionToken, sessionToken));
        
        const userResult = await db.select().from(users).where(eq(users.id, session.userId));
        if (userResult.length === 0) {
            return res.status(401).json({ error: "User not found" });
        }
        
        const user = userResult[0];
        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt
        });
    } catch (err) {
        console.error("Get current user error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// List all admins (super admin only)
export const handleListAdmins: RequestHandler = async (req, res) => {
    try {
        const allUsers = await db.select({
            id: users.id,
            username: users.username,
            role: users.role,
            createdAt: users.createdAt
        }).from(users);
        
        res.json({ admins: allUsers });
    } catch (err) {
        console.error("List admins error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Create new admin (super admin only)
export const handleCreateAdmin: RequestHandler = async (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }
    
    const adminRole = role === "superadmin" ? "superadmin" : "admin";
    
    try {
        // Check if username exists
        const existing = await db.select().from(users).where(eq(users.username, username));
        if (existing.length > 0) {
            return res.status(400).json({ error: "Username already exists" });
        }
        
        const { hash, salt } = hashPassword(password);
        
        await db.insert(users).values({
            username,
            password: `${salt}:${hash}`,
            role: adminRole,
        });
        
        await logActivity("admin_created", undefined, undefined, { newAdmin: username, role: adminRole }, req);
        
        res.json({ success: true, message: `Admin "${username}" created successfully` });
    } catch (err) {
        console.error("Create admin error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Update admin (super admin only)
export const handleUpdateAdmin: RequestHandler = async (req, res) => {
    const { id, username, password, role } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: "Admin ID required" });
    }
    
    try {
        const existing = await db.select().from(users).where(eq(users.id, id));
        if (existing.length === 0) {
            return res.status(404).json({ error: "Admin not found" });
        }
        
        const updates: any = {};
        if (username) updates.username = username;
        if (role) updates.role = role;
        if (password) {
            const { hash, salt } = hashPassword(password);
            updates.password = `${salt}:${hash}`;
        }
        
        if (Object.keys(updates).length > 0) {
            await db.update(users).set(updates).where(eq(users.id, id));
            await logActivity("admin_updated", undefined, undefined, { adminId: id, updates: Object.keys(updates) }, req);
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error("Update admin error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Delete admin (super admin only)
export const handleDeleteAdmin: RequestHandler = async (req, res) => {
    const { id } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: "Admin ID required" });
    }
    
    try {
        const existing = await db.select().from(users).where(eq(users.id, id));
        if (existing.length === 0) {
            return res.status(404).json({ error: "Admin not found" });
        }
        
        // Don't allow deleting the last super admin
        if (existing[0].role === "superadmin") {
            const superAdmins = await db.select().from(users).where(eq(users.role, "superadmin"));
            if (superAdmins.length <= 1) {
                return res.status(400).json({ error: "Cannot delete the last super admin" });
            }
        }
        
        // Delete related records first (to avoid foreign key constraint violations)
        await db.delete(adminSessions).where(eq(adminSessions.userId, id));
        await db.delete(activityLogs).where(eq(activityLogs.userId, id));
        
        // Now delete the user
        await db.delete(users).where(eq(users.id, id));
        
        await logActivity("admin_deleted", undefined, undefined, { deletedAdmin: existing[0].username }, req);
        
        res.json({ success: true });
    } catch (err) {
        console.error("Delete admin error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get activity logs (super admin only)
export const handleGetActivityLogs: RequestHandler = async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    try {
        const logs = await db.select()
            .from(activityLogs)
            .orderBy(desc(activityLogs.timestamp))
            .limit(limit)
            .offset(offset);
        
        res.json({ logs });
    } catch (err) {
        console.error("Get activity logs error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get active sessions (super admin only)
export const handleGetActiveSessions: RequestHandler = async (req, res) => {
    try {
        const sessions = await db.select({
            id: adminSessions.id,
            userId: adminSessions.userId,
            ipAddress: adminSessions.ipAddress,
            userAgent: adminSessions.userAgent,
            deviceInfo: adminSessions.deviceInfo,
            createdAt: adminSessions.createdAt,
            lastActiveAt: adminSessions.lastActiveAt,
            isActive: adminSessions.isActive,
        })
        .from(adminSessions)
        .where(eq(adminSessions.isActive, true))
        .orderBy(desc(adminSessions.lastActiveAt));
        
        // Get usernames for each session
        const sessionsWithUsers = await Promise.all(sessions.map(async (session) => {
            const userResult = await db.select({ username: users.username, role: users.role })
                .from(users)
                .where(eq(users.id, session.userId));
            return {
                ...session,
                username: userResult[0]?.username || "Unknown",
                role: userResult[0]?.role || "unknown"
            };
        }));
        
        res.json({ sessions: sessionsWithUsers });
    } catch (err) {
        console.error("Get active sessions error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Terminate session (super admin only)
export const handleTerminateSession: RequestHandler = async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
    }
    
    try {
        await db.update(adminSessions)
            .set({ isActive: false })
            .where(eq(adminSessions.id, sessionId));
        
        await logActivity("session_terminated", undefined, undefined, { sessionId }, req);
        
        res.json({ success: true });
    } catch (err) {
        console.error("Terminate session error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get website stats (super admin only)
export const handleGetWebsiteStats: RequestHandler = async (req, res) => {
    try {
        const { rooms, teams, questions } = await import("../schema.js");
        const { sql } = await import("drizzle-orm");
        
        const roomCount = await db.select({ count: sql<number>`count(*)` }).from(rooms);
        const teamCount = await db.select({ count: sql<number>`count(*)` }).from(teams);
        const questionCount = await db.select({ count: sql<number>`count(*)` }).from(questions);
        const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
        const activeSessionCount = await db.select({ count: sql<number>`count(*)` })
            .from(adminSessions)
            .where(eq(adminSessions.isActive, true));
        
        // Recent activity count (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentActivityCount = await db.select({ count: sql<number>`count(*)` })
            .from(activityLogs);
        
        res.json({
            stats: {
                totalRooms: Number(roomCount[0].count),
                totalTeams: Number(teamCount[0].count),
                totalQuestions: Number(questionCount[0].count),
                totalAdmins: Number(userCount[0].count),
                activeSessions: Number(activeSessionCount[0].count),
                recentActivities: Number(recentActivityCount[0].count),
            }
        });
    } catch (err) {
        console.error("Get website stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export async function ensureDefaultAdmin() {
    try {
        // Check for super admin first
        const superAdmins = await db.select().from(users).where(eq(users.role, "superadmin"));
        
        if (superAdmins.length === 0) {
            // No super admin exists, create one
            const { hash, salt } = hashPassword("SUPERADMIN@123");
            
            // Check if 'admin' user exists
            const existing = await db.select().from(users).where(eq(users.username, "admin"));
            
            if (existing.length === 0) {
                // Create super admin
                await db.insert(users).values({
                    username: "admin",
                    password: `${salt}:${hash}`,
                    role: "superadmin",
                });
                console.log("Default super admin created: admin / SUPERADMIN@123");
            } else {
                // Upgrade existing admin to super admin
                await db.update(users)
                    .set({ 
                        password: `${salt}:${hash}`,
                        role: "superadmin"
                    })
                    .where(eq(users.username, "admin"));
                console.log("Upgraded admin to super admin: admin / SUPERADMIN@123");
            }
        } else {
            // Super admin exists - ensure password format is correct by updating it
            const { hash, salt } = hashPassword("SUPERADMIN@123");
            await db.update(users)
                .set({ password: `${salt}:${hash}` })
                .where(eq(users.username, "admin"));
            console.log("Super admin password reset: admin / SUPERADMIN@123");
        }
    } catch (err) {
        console.warn("Failed to ensure default admin (might be db connection issue):", err);
    }
}

// Get all teams (super admin only)
export const handleGetAllTeams: RequestHandler = async (req, res) => {
    try {
        const allTeams = await db.select().from(teams);
        res.json({ teams: allTeams });
    } catch (err) {
        console.error("Get all teams error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get all questions (super admin only)
export const handleGetAllQuestions: RequestHandler = async (req, res) => {
    try {
        const allQuestions = await db.select().from(questionsTable);
        res.json({ questions: allQuestions });
    } catch (err) {
        console.error("Get all questions error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};
