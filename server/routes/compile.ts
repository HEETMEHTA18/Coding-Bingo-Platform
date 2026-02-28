import express from "express";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import os from "os";

const router = express.Router();

// Security configuration
const SECURITY_CONFIG = {
  maxSourceSize: 50000, // 50KB max source code
  maxOutputSize: 10000, // 10KB max output
  timeout: parseInt(process.env.COMPILER_TIMEOUT || "10000"), // 10s default
  memoryLimit: process.env.COMPILER_MEMORY_LIMIT || "256m",
  cpuLimit: process.env.COMPILER_CPU_LIMIT || "0.5",
};

interface CompileRequest {
  language: "c" | "cpp";
  source: string;
  stdin?: string;
}

interface CompileResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  error?: string;
  executionTime?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PISTON API  (free, no key, fastest: ~1-3s)
//    https://github.com/engineer-man/piston
// ─────────────────────────────────────────────────────────────────────────────
const PISTON_LANGUAGES: Record<string, { language: string; version: string }> = {
  c: { language: "c", version: "10.2.0" },
  cpp: { language: "c++", version: "10.2.0" },
};

async function compileWithPiston(
  language: "c" | "cpp",
  source: string,
  stdin?: string
): Promise<CompileResult> {
  const pistonUrl =
    process.env.PISTON_API_URL || "https://emkc.org/api/v2/piston/execute";
  const lang = PISTON_LANGUAGES[language];

  console.log(`[Piston] Compiling ${language.toUpperCase()}...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(pistonUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: lang.language,
        version: lang.version,
        files: [
          {
            name: language === "c" ? "main.c" : "main.cpp",
            content: source,
          },
        ],
        stdin: stdin || "",
        run_timeout: 5000,
        compile_timeout: 10000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Piston] HTTP ${response.status}: ${text}`);
      return { success: false, error: `Piston API error: ${response.status}` };
    }

    const result = await response.json();
    console.log(
      `[Piston] compile.code=${result.compile?.code} run.code=${result.run?.code}`
    );

    // Compile error
    if (result.compile && result.compile.code !== 0) {
      return {
        success: false,
        error: "Compilation error",
        compileOutput:
          result.compile.stderr || result.compile.output || "Compilation failed",
      };
    }

    // Runtime error (but still return stdout if any)
    const stdout = (result.run?.stdout || "").trim();
    const stderr = (result.run?.stderr || result.compile?.stderr || "").trim();

    if (result.run && result.run.code !== 0 && !stdout) {
      return {
        success: false,
        error: "Runtime error",
        stderr: stderr || "Program exited with non-zero status",
      };
    }

    return { success: true, stdout, stderr };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { success: false, error: "Piston API timeout (9s)" };
    }
    console.error("[Piston] Error:", err.message);
    return { success: false, error: `Piston request failed: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DOCKER  (local, no internet needed, ~10-60s cold, ~3-5s warm)
// ─────────────────────────────────────────────────────────────────────────────
async function checkDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const docker = spawn("docker", ["version"], { stdio: "ignore" });
    docker.on("close", (code) => resolve(code === 0));
    docker.on("error", () => resolve(false));
    setTimeout(() => {
      docker.kill();
      resolve(false);
    }, 3000);
  });
}

async function compileWithDocker(
  language: "c" | "cpp",
  tmpDir: string,
  filename: string
): Promise<CompileResult> {
  return new Promise((resolve) => {
    const compiler = language === "c" ? "gcc" : "g++";
    const standard = language === "c" ? "-std=c11" : "-std=c++17";

    const compileCmd =
      `${compiler} ${standard} -O2 ${filename} -o a.out 2>compile.err || cat compile.err; ` +
      `if [ -f a.out ]; then timeout ${SECURITY_CONFIG.timeout / 1000}s ./a.out </dev/null; fi`;

    const dockerArgs = [
      "run", "--rm",
      "--network", "none",
      "--memory", SECURITY_CONFIG.memoryLimit,
      "--cpus", SECURITY_CONFIG.cpuLimit,
      "--security-opt", "no-new-privileges:true",
      "-v", `${tmpDir}:/workspace`,
      "-w", "/workspace",
      "gcc:latest", "bash", "-c", compileCmd,
    ];

    const docker = spawn("docker", dockerArgs, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let killed = false;

    docker.stdout?.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > SECURITY_CONFIG.maxOutputSize) {
        stdout = stdout.substring(0, SECURITY_CONFIG.maxOutputSize) + "\n[Output truncated]";
        if (!killed) { killed = true; docker.kill(); }
      }
    });

    docker.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      if (!killed) {
        killed = true;
        docker.kill();
        resolve({ success: false, error: `Execution timeout (${SECURITY_CONFIG.timeout}ms)`, stderr });
      }
    }, SECURITY_CONFIG.timeout + 2000);

    docker.on("close", (code) => {
      clearTimeout(timeoutId);
      if (killed) return;

      const compileErrorPath = join(tmpDir, "compile.err");
      let compileOutput = "";
      try {
        if (existsSync(compileErrorPath)) {
          compileOutput = require("fs").readFileSync(compileErrorPath, "utf-8");
        }
      } catch { }

      if (compileOutput.trim()) {
        resolve({ success: false, error: "Compilation failed", compileOutput });
      } else if (code === 0) {
        resolve({ success: true, stdout: stdout || "", stderr: stderr || undefined });
      } else {
        resolve({ success: false, error: `Runtime error (exit code ${code})`, stderr });
      }
    });

    docker.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({ success: false, error: "Failed to run Docker", stderr: err.message });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/compile  — tries Piston → Judge0 → Docker in order
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/compile", async (req, res) => {
  const startTime = Date.now();
  const { language, source, stdin }: CompileRequest = req.body;

  if (!source || !language) {
    return res.status(400).json({ error: "Missing source or language" });
  }
  if (!["c", "cpp"].includes(language)) {
    return res.status(400).json({ error: "Language must be 'c' or 'cpp'" });
  }
  if (source.length > SECURITY_CONFIG.maxSourceSize) {
    return res.status(400).json({
      error: `Source code too large (max ${SECURITY_CONFIG.maxSourceSize} bytes)`,
    });
  }

  const forceDocker = process.env.FORCE_DOCKER === "true";
  const forceJudge0 = process.env.FORCE_JUDGE0 === "true";

  // 1️⃣ Try Piston first (fastest, always available)
  if (!forceDocker && !forceJudge0) {
    const pistonResult = await compileWithPiston(language, source, stdin);
    if (pistonResult.success || pistonResult.compileOutput) {
      // compileOutput means compile ERROR — still a definitive result
      pistonResult.executionTime = Date.now() - startTime;
      return res.json(pistonResult);
    }
    console.warn("[Piston] Failed, trying Judge0 fallback...", pistonResult.error);
  }

  // 2️⃣ Try Judge0 if Piston failed or forced
  if (!forceDocker && process.env.JUDGE0_API_KEY) {
    const j0Result = await compileWithJudge0(language, source, stdin);
    if (j0Result.success || j0Result.compileOutput) {
      j0Result.executionTime = Date.now() - startTime;
      return res.json(j0Result);
    }
    console.warn("[Judge0] Failed, trying Docker fallback...", j0Result.error);
  }

  // 3️⃣ Try Docker (local, slowest)
  const dockerAvailable = await checkDockerAvailable();
  if (!dockerAvailable) {
    return res.status(503).json({
      success: false,
      error:
        "All compilers unavailable. Piston unreachable, no JUDGE0_API_KEY, Docker not running.",
    });
  }

  let tmpDir: string | null = null;
  try {
    tmpDir = mkdtempSync(join(os.tmpdir(), "code-"));
    const filename = language === "c" ? "main.c" : "main.cpp";
    writeFileSync(join(tmpDir, filename), source, "utf-8");
    if (stdin) writeFileSync(join(tmpDir, "input.txt"), stdin, "utf-8");

    const result = await compileWithDocker(language, tmpDir, filename);
    result.executionTime = Date.now() - startTime;
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { }
    }
  }
});

// GET /api/compile/health
router.get("/api/compile/health", async (_req, res) => {
  const pistonOk = await compileWithPiston("c", '#include <stdio.h>\nint main(){printf("ok");return 0;}')
    .then((r) => r.success)
    .catch(() => false);

  const dockerAvailable = await checkDockerAvailable();

  res.json({
    status: pistonOk ? "healthy" : dockerAvailable ? "docker-only" : "degraded",
    piston: pistonOk ? "available" : "unavailable",
    docker: dockerAvailable ? "available" : "unavailable",
  });
});

export default router;
