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

// Judge0 Language IDs
const JUDGE0_LANGUAGES = {
  c: 50,    // C (GCC 9.2.0)
  cpp: 54,  // C++ (GCC 9.2.0)
};

/**
 * Compile using Judge0 online compiler API
 */
async function compileWithJudge0(
  language: "c" | "cpp",
  source: string,
  stdin?: string
): Promise<CompileResult> {
  try {
    const apiKey = process.env.JUDGE0_API_KEY;
    const apiUrl = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";

    if (!apiKey) {
      return {
        success: false,
        error: "JUDGE0_API_KEY not set. Get free key at: https://rapidapi.com/judge0-official/api/judge0-ce",
      };
    }

    // Submit code for compilation
    const response = await fetch(`${apiUrl}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      body: JSON.stringify({
        language_id: JUDGE0_LANGUAGES[language],
        source_code: source,
        stdin: stdin || "",
        cpu_time_limit: 5,
        memory_limit: 262144, // 256 MB
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Judge0 API error: ${response.status} ${response.statusText}`,
        stderr: errorText,
      };
    }

    const result = await response.json();

    // Status codes:
    // 3 = Accepted (success)
    // 6 = Compilation Error
    // 5 = Time Limit Exceeded
    // 11-12 = Runtime Error
    if (result.status.id === 3) {
      return {
        success: true,
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        executionTime: result.time ? parseFloat(result.time) * 1000 : 0,
      };
    } else if (result.status.id === 6) {
      return {
        success: false,
        compileOutput: result.compile_output || result.stderr || "Compilation failed",
        error: "Compilation error",
      };
    } else if (result.status.id === 5) {
      return {
        success: false,
        error: "Time limit exceeded",
        stderr: result.stderr || "",
      };
    } else {
      return {
        success: false,
        error: result.status.description || "Execution failed",
        stderr: result.stderr || "",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Judge0 request failed: ${error.message}`,
    };
  }
}

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

/**
 * POST /api/compile
 * Compile and run C/C++ code using Docker GCC container
 */
router.post("/api/compile", async (req, res) => {
  const startTime = Date.now();
  const { language, source, stdin }: CompileRequest = req.body;

  // Validation
  if (!source || !language) {
    return res.status(400).json({ error: "Missing source or language" });
  }

  if (!["c", "cpp"].includes(language)) {
    return res.status(400).json({ error: "Language must be 'c' or 'cpp'" });
  }

  if (source.length > SECURITY_CONFIG.maxSourceSize) {
    return res
      .status(400)
      .json({ error: `Source code too large (max ${SECURITY_CONFIG.maxSourceSize} bytes)` });
  }

  // Check if Docker is available
  const useOnlineCompiler = process.env.USE_ONLINE_COMPILER === "true";
  const dockerAvailable = !useOnlineCompiler && await checkDockerAvailable();

  if (useOnlineCompiler) {
    console.log("Using online Judge0 compiler (Docker disabled)");
    const result = await compileWithJudge0(language, source, stdin);
    result.executionTime = Date.now() - startTime;
    return res.json(result);
  }

  if (!dockerAvailable) {
    return res.status(503).json({
      error: "Docker is not available. Set USE_ONLINE_COMPILER=true in .env to use online compiler instead.",
      hint: "See EASY_START.md for setup without Docker",
    });
  }

  let tmpDir: string | null = null;

  try {
    // Create temporary directory
    tmpDir = mkdtempSync(join(os.tmpdir(), "code-"));
    const filename = language === "c" ? "main.c" : "main.cpp";
    const sourcePath = join(tmpDir, filename);

    // Write source code
    writeFileSync(sourcePath, source, "utf-8");

    // If stdin provided, write it
    if (stdin) {
      writeFileSync(join(tmpDir, "input.txt"), stdin, "utf-8");
    }

    // Compile and run
    const result = await compileAndRun(language, tmpDir, filename);

    // Add execution time
    result.executionTime = Date.now() - startTime;

    res.json(result);
  } catch (error: any) {
    console.error("Compilation error:", error);
    res.status(500).json({
      error: "Compilation service error",
      details: error.message,
      executionTime: Date.now() - startTime,
    });
  } finally {
    // Cleanup
    if (tmpDir) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to cleanup temp directory:", e);
      }
    }
  }
});

/**
 * Check if Docker is available
 */
async function checkDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const docker = spawn("docker", ["version"], { stdio: "ignore" });
    docker.on("close", (code) => resolve(code === 0));
    docker.on("error", () => resolve(false));
    // Timeout after 3 seconds
    setTimeout(() => {
      docker.kill();
      resolve(false);
    }, 3000);
  });
}

/**
 * Compile and run code using Docker
 */
async function compileAndRun(
  language: "c" | "cpp",
  tmpDir: string,
  filename: string
): Promise<CompileResult> {
  return new Promise((resolve) => {
    const compiler = language === "c" ? "gcc" : "g++";
    const standard = language === "c" ? "-std=c11" : "-std=c++17";

    // Docker command:
    // 1. Compile the code
    // 2. If compilation fails, output compile errors
    // 3. If compilation succeeds, run the binary with timeout
    const compileCmd =
      `${compiler} ${standard} -O2 ${filename} -o a.out 2> compile.err || cat compile.err; ` +
      `if [ -f a.out ]; then timeout ${SECURITY_CONFIG.timeout / 1000}s ./a.out < /dev/null; fi`;

    const dockerArgs = [
      "run",
      "--rm",
      "--network", "none", // No network access
      "--memory", SECURITY_CONFIG.memoryLimit,
      "--cpus", SECURITY_CONFIG.cpuLimit,
      "--security-opt", "no-new-privileges:true",
      "-v", `${tmpDir}:/workspace`,
      "-w", "/workspace",
      "gcc:latest",
      "bash",
      "-c",
      compileCmd,
    ];

    console.log("Running Docker:", "docker", dockerArgs.slice(0, 10).join(" "), "...");

    const docker = spawn("docker", dockerArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    // Capture output
    docker.stdout?.on("data", (data) => {
      stdout += data.toString();
      // Limit output size
      if (stdout.length > SECURITY_CONFIG.maxOutputSize) {
        stdout = stdout.substring(0, SECURITY_CONFIG.maxOutputSize) + "\n[Output truncated]";
        if (!killed) {
          killed = true;
          docker.kill();
        }
      }
    });

    docker.stderr?.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > SECURITY_CONFIG.maxOutputSize) {
        stderr = stderr.substring(0, SECURITY_CONFIG.maxOutputSize) + "\n[Error truncated]";
      }
    });

    // Timeout protection
    const timeoutId = setTimeout(() => {
      if (!killed) {
        killed = true;
        docker.kill();
        resolve({
          success: false,
          error: `Execution timeout (${SECURITY_CONFIG.timeout}ms)`,
          stderr: stderr || "Process killed due to timeout",
        });
      }
    }, SECURITY_CONFIG.timeout + 2000); // Give Docker 2s extra for cleanup

    docker.on("close", (code) => {
      clearTimeout(timeoutId);

      if (killed) return; // Already resolved due to timeout

      // Check if compilation failed (compile.err has content)
      const compileErrorPath = join(tmpDir, "compile.err");
      let compileOutput = "";
      try {
        if (existsSync(compileErrorPath)) {
          compileOutput = require("fs").readFileSync(compileErrorPath, "utf-8");
        }
      } catch (e) {
        // Ignore
      }

      if (compileOutput.trim()) {
        // Compilation error
        resolve({
          success: false,
          error: "Compilation failed",
          compileOutput: compileOutput,
          stderr: stderr || undefined,
        });
      } else if (code === 0) {
        // Success
        resolve({
          success: true,
          stdout: stdout || "",
          stderr: stderr || undefined,
        });
      } else if (code === 124 || stderr.includes("timeout")) {
        // Timeout
        resolve({
          success: false,
          error: "Execution timeout",
          stderr: stderr || "Program exceeded time limit",
        });
      } else {
        // Runtime error
        resolve({
          success: false,
          error: `Runtime error (exit code ${code})`,
          stdout: stdout || undefined,
          stderr: stderr || "Program crashed or returned non-zero exit code",
        });
      }
    });

    docker.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: "Failed to run Docker container",
        stderr: err.message,
      });
    });
  });
}

/**
 * GET /api/compile/health
 * Check if compiler service is ready
 */
router.get("/api/compile/health", async (req, res) => {
  const dockerAvailable = await checkDockerAvailable();

  if (dockerAvailable) {
    res.json({
      status: "healthy",
      docker: "available",
      compiler: "gcc:latest",
    });
  } else {
    res.status(503).json({
      status: "unhealthy",
      docker: "unavailable",
      message: "Docker is not running. Start Docker Desktop to enable compilation.",
    });
  }
});

export default router;
