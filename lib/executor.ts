import { spawn, ChildProcess } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { promisify } from "util";
import { exec } from "child_process";
import { rustEngineClient, RustEngineRequest } from "./rust-engine-client";

const execAsync = promisify(exec);

// Check if Rust engine should be used (environment variable)
const USE_RUST_ENGINE =
  process.env.USE_RUST_ENGINE === "true" ||
  process.env.NODE_ENV === "production";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  memoryUsage: number;
  error?: string;
  killed?: boolean;
  timedOut?: boolean;
  compileOutput?: string;
}

export interface LanguageConfig {
  id: string;
  name: string;
  extension: string;
  compileCommand?: string;
  runCommand: string;
  dockerImage?: string;
  timeout: number;
  memoryLimit: number;
  cpuLimit?: string;
}

// Get command paths from environment or fallback to defaults
const getCompilerPath = (envVar: string, fallback: string): string => {
  return process.env[envVar] || fallback;
};

// Check if we're on Windows
const isWindows = process.platform === "win32";

export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  python: {
    id: "python",
    name: "Python 3.x",
    extension: "py",
    runCommand: `${getCompilerPath("PYTHON_PATH", "python")} {file}`,
    dockerImage: "python:3.11-alpine",
    timeout: 10000,
    memoryLimit: 128 * 1024 * 1024, // 128MB
    cpuLimit: "0.5",
  },
  javascript: {
    id: "javascript",
    name: "Node.js",
    extension: "js",
    runCommand: `${getCompilerPath("NODEJS_PATH", "node")} {file}`,
    dockerImage: "node:18-alpine",
    timeout: 10000,
    memoryLimit: 128 * 1024 * 1024,
    cpuLimit: "0.5",
  },
  java: {
    id: "java",
    name: "Java",
    extension: "java",
    compileCommand: `${getCompilerPath("JAVAC_PATH", "javac")} {file}`,
    runCommand: `${getCompilerPath("JAVA_PATH", "java")} {classname}`,
    dockerImage: "openjdk:17-alpine",
    timeout: 15000,
    memoryLimit: 256 * 1024 * 1024,
    cpuLimit: "0.5",
  },
  cpp: {
    id: "cpp",
    name: "C++",
    extension: "cpp",
    compileCommand: `${getCompilerPath("GPP_PATH", "g++")} -o {output}${
      isWindows ? ".exe" : ""
    } {file} -std=c++17`,
    runCommand: isWindows ? "{output}.exe" : "./{output}",
    dockerImage: "gcc:11-alpine",
    timeout: 15000,
    memoryLimit: 128 * 1024 * 1024,
    cpuLimit: "0.5",
  },
  c: {
    id: "c",
    name: "C",
    extension: "c",
    compileCommand: `${getCompilerPath("GCC_PATH", "gcc")} -o {output}${
      isWindows ? ".exe" : ""
    } {file} -std=c17 -lm`,
    runCommand: isWindows ? "{output}.exe" : "./{output}",
    dockerImage: "gcc:11-alpine",
    timeout: 15000,
    memoryLimit: 128 * 1024 * 1024,
    cpuLimit: "0.5",
  },
  go: {
    id: "go",
    name: "Go",
    extension: "go",
    runCommand: `${getCompilerPath("GO_PATH", "go")} run {file}`,
    dockerImage: "golang:1.21-alpine",
    timeout: 10000,
    memoryLimit: 128 * 1024 * 1024,
    cpuLimit: "0.5",
  },
  rust: {
    id: "rust",
    name: "Rust",
    extension: "rs",
    compileCommand: `${getCompilerPath(
      "RUSTC_PATH",
      "rustc"
    )} {file} -o {output}${isWindows ? ".exe" : ""}`,
    runCommand: isWindows ? "{output}.exe" : "./{output}",
    dockerImage: "rust:1.70-alpine",
    timeout: 20000,
    memoryLimit: 256 * 1024 * 1024,
    cpuLimit: "0.5",
  },
};

export class CodeExecutor {
  private workingDir: string;
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private runningContainers: Map<string, string> = new Map();
  private useDocker: boolean;
  private useLocalCompilers: boolean;

  constructor(
    workingDir: string = "./tmp",
    useDocker: boolean = process.env.USE_DOCKER === "true"
  ) {
    this.workingDir = workingDir;
    this.useDocker = useDocker;
    this.useLocalCompilers = process.env.USE_LOCAL_COMPILERS === "true";

    try {
      mkdirSync(this.workingDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  async checkDockerAvailability(): Promise<boolean> {
    try {
      await execAsync("docker --version");
      return true;
    } catch (error) {
      console.warn("Docker not available, falling back to local execution");
      return false;
    }
  }

  async executeCode(
    language: string,
    code: string,
    input: string = "",
    submissionId: string
  ): Promise<ExecutionResult> {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Prefer local execution if enabled, otherwise check Docker
    if (this.useLocalCompilers) {
      return this.executeLocally(config, code, input, submissionId);
    }

    // Check if Docker is available and configured
    const dockerAvailable =
      this.useDocker && (await this.checkDockerAvailability());

    if (dockerAvailable && config.dockerImage) {
      return this.executeInDocker(config, code, input, submissionId);
    } else {
      return this.executeLocally(config, code, input, submissionId);
    }
  }

  private async executeInDocker(
    config: LanguageConfig,
    code: string,
    input: string,
    submissionId: string
  ): Promise<ExecutionResult> {
    const sessionId = uuidv4();
    const sessionDir = join(this.workingDir, sessionId);
    mkdirSync(sessionDir, { recursive: true });

    const filename = `main.${config.extension}`;
    const filepath = join(sessionDir, filename);
    const outputPath = `main`;

    try {
      // Write code to file
      writeFileSync(filepath, code);

      // Write input to file
      const inputPath = join(sessionDir, "input.txt");
      writeFileSync(inputPath, input);

      const startTime = Date.now();
      let result: ExecutionResult;

      // Compile if needed
      if (config.compileCommand) {
        const compileCmd = this.buildDockerCommand(
          config,
          config.compileCommand,
          sessionDir,
          filename,
          outputPath
        );
        const compileResult = await this.runDockerCommand(
          compileCmd,
          submissionId,
          30000
        ); // 30s compile timeout

        if (compileResult.exitCode !== 0) {
          return {
            stdout: compileResult.stdout,
            stderr: compileResult.stderr,
            exitCode: compileResult.exitCode,
            executionTime: Date.now() - startTime,
            memoryUsage: 0,
            error: "Compilation failed",
          };
        }
      }

      // Execute
      const runCmd = this.buildDockerCommand(
        config,
        config.runCommand,
        sessionDir,
        filename,
        outputPath,
        true
      );
      result = await this.runDockerCommand(
        runCmd,
        submissionId,
        config.timeout,
        input
      );
      result.executionTime = Date.now() - startTime;

      return result;
    } catch (error) {
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : "Unknown error",
        exitCode: -1,
        executionTime: Date.now() - Date.now(),
        memoryUsage: 0,
        error: "Docker execution failed",
      };
    } finally {
      this.cleanup(sessionDir);
    }
  }

  private buildDockerCommand(
    config: LanguageConfig,
    command: string,
    sessionDir: string,
    filename: string,
    outputPath: string,
    withInput: boolean = false
  ): string {
    const memoryLimitMB = Math.floor(config.memoryLimit / (1024 * 1024));

    let dockerCmd = [
      "docker run",
      "--rm",
      "--network=none", // No network access
      `--memory=${memoryLimitMB}m`,
      `--cpus=${config.cpuLimit || "0.5"}`,
      "--user=nobody", // Run as non-root user
      "--read-only", // Read-only filesystem
      "--tmpfs /tmp", // Writable tmp directory
      `--volume "${sessionDir}:/workspace"`,
      "--workdir=/workspace",
      config.dockerImage,
    ];

    // Add timeout wrapper
    dockerCmd.push("timeout", `${Math.floor(config.timeout / 1000)}s`);

    // Build the actual command
    const actualCommand = command
      .replace(/{file}/g, filename)
      .replace(/{output}/g, outputPath)
      .replace(/{classname}/g, "Main");

    if (withInput) {
      dockerCmd.push("sh", "-c", `${actualCommand} < input.txt`);
    } else {
      dockerCmd.push("sh", "-c", actualCommand);
    }

    return dockerCmd.join(" ");
  }

  private async runDockerCommand(
    command: string,
    submissionId: string,
    timeout: number,
    input?: string
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn("sh", ["-c", command], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.runningProcesses.set(submissionId, child);

      let stdout = "";
      let stderr = "";
      let killed = false;
      let timedOut = false;

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      // Send input if provided
      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }

      // Timeout handler
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
        stderr += "\nExecution timed out";
      }, timeout);

      child.on("close", (code) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(submissionId);

        const executionTime = Date.now() - startTime;

        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
          executionTime,
          memoryUsage: 0, // Docker doesn't easily provide memory usage
          killed,
          timedOut,
        });
      });

      child.on("error", (error) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(submissionId);

        resolve({
          stdout: "",
          stderr: error.message,
          exitCode: -1,
          executionTime: Date.now() - startTime,
          memoryUsage: 0,
          error: "Process error",
        });
      });
    });
  }

  private async executeLocally(
    config: LanguageConfig,
    code: string,
    input: string,
    submissionId: string
  ): Promise<ExecutionResult> {
    const sessionId = uuidv4();
    const sessionDir = join(this.workingDir, sessionId);
    mkdirSync(sessionDir, { recursive: true });

    // Handle Java specially - extract class name from code
    let filename: string;
    let classname = "Main";

    if (config.id === "java") {
      const classMatch = code.match(/public\s+class\s+(\w+)/);
      if (classMatch) {
        classname = classMatch[1];
        filename = `${classname}.${config.extension}`;
      } else {
        filename = `Main.${config.extension}`;
      }
    } else {
      filename = `main.${config.extension}`;
    }

    const filepath = join(sessionDir, filename);
    const outputPath = join(sessionDir, "main");

    try {
      // Write code to file
      writeFileSync(filepath, code);

      let executionTime = 0;
      let memoryUsage = 0;

      // Compile if needed
      if (config.compileCommand) {
        const compileResult = await this.runCommand(
          config.compileCommand
            .replace(/{file}/g, filename) // Use filename instead of filepath
            .replace(/{output}/g, "main") // Use relative output path
            .replace(/{classname}/g, classname),
          sessionDir,
          submissionId,
          30000 // 30 second compile timeout
        );

        if (compileResult.exitCode !== 0) {
          return {
            stdout: "",
            stderr: compileResult.stderr,
            exitCode: compileResult.exitCode,
            executionTime: compileResult.executionTime,
            memoryUsage: 0,
            error: "Compilation failed",
          };
        }
      }

      // Execute
      const runCommand = config.runCommand
        .replace(/{file}/g, filename) // Use filename instead of filepath
        .replace(/{output}/g, "main") // Use relative output path
        .replace(/{classname}/g, classname);

      const result = await this.runCommand(
        runCommand,
        sessionDir,
        submissionId,
        config.timeout,
        input
      );

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTime: result.executionTime,
        memoryUsage: result.memoryUsage,
      };
    } catch (error) {
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : "Unknown error",
        exitCode: -1,
        executionTime: 0,
        memoryUsage: 0,
        error: "Execution failed",
      };
    } finally {
      // Cleanup
      this.cleanup(sessionDir);
    }
  }

  private async runCommand(
    command: string,
    cwd: string,
    submissionId: string,
    timeout: number,
    input?: string
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      // Better command parsing for Windows and Unix
      let cmd: string;
      let cmdArgs: string[];

      if (isWindows) {
        // On Windows, use cmd.exe to handle the command
        cmd = "cmd";
        cmdArgs = ["/C", command];
      } else {
        // On Unix-like systems, use shell
        cmd = "sh";
        cmdArgs = ["-c", command];
      }

      const child = spawn(cmd, cmdArgs, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          // Override problematic NODE_PATH
          NODE_PATH: undefined,
          PATH: process.env.PATH,
        },
        shell: false, // We're handling shell invocation manually
      });

      this.runningProcesses.set(submissionId, child);

      let stdout = "";
      let stderr = "";
      let maxMemory = 0;
      let killed = false;
      let timedOut = false;

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      // Send input if provided
      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }

      // Timeout handler
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
        stderr += "\nExecution timed out";
      }, timeout);

      child.on("close", (code) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(submissionId);

        const executionTime = Date.now() - startTime;

        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
          executionTime,
          memoryUsage: maxMemory,
          killed,
          timedOut,
        });
      });

      child.on("error", (error) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(submissionId);

        resolve({
          stdout: "",
          stderr: error.message,
          exitCode: -1,
          executionTime: Date.now() - startTime,
          memoryUsage: 0,
          error: "Process error",
        });
      });
    });
  }
  async stopExecution(submissionId: string): Promise<boolean> {
    let stopped = false;

    // Stop local process if exists
    const process = this.runningProcesses.get(submissionId);
    if (process) {
      process.kill("SIGTERM");
      this.runningProcesses.delete(submissionId);
      stopped = true;
    }

    // Stop Docker container if exists
    const containerId = this.runningContainers.get(submissionId);
    if (containerId) {
      try {
        await execAsync(`docker stop ${containerId}`);
        await execAsync(`docker rm ${containerId}`);
        this.runningContainers.delete(submissionId);
        stopped = true;
      } catch (error) {
        console.error(`Failed to stop container ${containerId}:`, error);
      }
    }

    return stopped;
  }

  private cleanup(sessionDir: string) {
    try {
      if (existsSync(sessionDir)) {
        rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  }

  async getSystemInfo() {
    const dockerAvailable = await this.checkDockerAvailability();
    return {
      workingDir: this.workingDir,
      dockerAvailable,
      useDocker: this.useDocker,
      supportedLanguages: Object.keys(LANGUAGE_CONFIGS),
      runningProcesses: this.runningProcesses.size,
    };
  }

  async executeWithRustEngine(
    language: string,
    code: string,
    input: string,
    submissionId: string,
    options: {
      compiler_options?: string;
      command_line_arguments?: string;
      cpu_time_limit?: number;
      cpu_extra_time?: number;
      memory_limit?: number;
      wall_time_limit?: number;
      stack_limit?: number;
      max_processes_and_or_threads?: number;
      enable_per_process_and_thread_time_limit?: boolean;
      enable_per_process_and_thread_memory_limit?: boolean;
      max_file_size?: number;
      redirect_stderr_to_stdout?: boolean;
      enable_network?: boolean;
      number_of_runs?: number;
      callback_url?: string;
      additional_files?: string;
    } = {}
  ): Promise<ExecutionResult> {
    try {
      // Map language names to what the Rust engine expects
      const languageMap: { [key: string]: string } = {
        python: "python",
        javascript: "javascript",
        cpp: "cpp",
        c: "c",
        rust: "rust",
        java: "java",
        go: "go",
      };

      const rustLanguage = languageMap[language.toLowerCase()] || language;

      // Prepare request for Rust engine
      const request: RustEngineRequest = {
        id: submissionId,
        language: rustLanguage,
        source_code: code,
        stdin: input,
        compiler_options: options.compiler_options,
        command_line_arguments: options.command_line_arguments,
        cpu_time_limit: options.cpu_time_limit || 5.0,
        cpu_extra_time: options.cpu_extra_time || 0.5,
        memory_limit: options.memory_limit || 256 * 1024 * 1024,
        wall_time_limit: options.wall_time_limit || 10.0,
        stack_limit: options.stack_limit || 64 * 1024 * 1024,
        max_processes_and_or_threads: options.max_processes_and_or_threads || 1,
        enable_per_process_and_thread_time_limit:
          options.enable_per_process_and_thread_time_limit || false,
        enable_per_process_and_thread_memory_limit:
          options.enable_per_process_and_thread_memory_limit || true,
        max_file_size: options.max_file_size || 1024 * 1024,
        redirect_stderr_to_stdout: options.redirect_stderr_to_stdout || false,
        enable_network: options.enable_network || false,
        number_of_runs: options.number_of_runs || 1,
        callback_url: options.callback_url,
        additional_files: options.additional_files,
      };

      // Submit to Rust engine
      const response = await rustEngineClient.submitExecution(request);

      // Poll for result (with timeout)
      const maxWaitTime = (options.wall_time_limit || 10) + 5; // Add 5 seconds buffer
      const pollInterval = 500; // 500ms
      const maxPolls = Math.ceil((maxWaitTime * 1000) / pollInterval);

      for (let i = 0; i < maxPolls; i++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const result = await rustEngineClient.getExecutionResult(submissionId);

        if (result) {
          // Map Rust engine result to our ExecutionResult format
          return {
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            compileOutput: result.compile_output,
            exitCode: result.exit_code || 0,
            executionTime: (result.time || 0) * 1000, // Convert to milliseconds
            memoryUsage: result.memory || 0,
            error:
              result.status === "internal_error"
                ? "Internal execution error"
                : undefined,
            killed: result.signal !== undefined,
            timedOut: result.status === "time_limit_exceeded",
          };
        }
      }

      // If we get here, execution timed out
      await rustEngineClient.cancelExecution(submissionId);
      return {
        stdout: "",
        stderr: "Execution timed out",
        exitCode: -1,
        executionTime: maxWaitTime * 1000,
        memoryUsage: 0,
        error: "Execution timed out",
        timedOut: true,
      };
    } catch (error) {
      console.error("Rust engine execution failed:", error);

      // Fallback to original execution
      console.log("Falling back to original execution...");
      return this.executeOriginal(language, code, input, submissionId);
    }
  }

  async execute(
    language: string,
    code: string,
    input: string,
    submissionId: string,
    options: {
      compiler_options?: string;
      command_line_arguments?: string;
      cpu_time_limit?: number;
      cpu_extra_time?: number;
      wall_time_limit?: number;
      memory_limit?: number;
      stack_limit?: number;
      max_processes_and_or_threads?: number;
      enable_per_process_and_thread_time_limit?: boolean;
      enable_per_process_and_thread_memory_limit?: boolean;
      max_file_size?: number;
      redirect_stderr_to_stdout?: boolean;
      enable_network?: boolean;
      number_of_runs?: number;
      callback_url?: string;
      additional_files?: string;
    } = {}
  ): Promise<ExecutionResult> {
    // Use Rust engine if available and enabled
    if (USE_RUST_ENGINE) {
      const isRustEngineHealthy = await rustEngineClient.healthCheck();
      if (isRustEngineHealthy) {
        console.log("🦀 Using Rust engine for execution");
        return this.executeWithRustEngine(
          language,
          code,
          input,
          submissionId,
          options
        );
      } else {
        console.warn(
          "⚠️ Rust engine not available, falling back to local execution"
        );
      }
    }

    // Override config with per-submission options
    const baseConfig = LANGUAGE_CONFIGS[language];
    if (!baseConfig) throw new Error(`Unsupported language: ${language}`);
    const config: LanguageConfig = {
      ...baseConfig,
      timeout: options.wall_time_limit
        ? Math.round(options.wall_time_limit * 1000)
        : baseConfig.timeout,
      memoryLimit: options.memory_limit || baseConfig.memoryLimit,
      cpuLimit: baseConfig.cpuLimit, // TODO: map cpu_time_limit/cpu_extra_time
    };
    // TODO: Pass stack_limit, max_processes_and_or_threads, etc. to Docker/local

    // Check if Docker is available and configured
    const dockerAvailable =
      this.useDocker && (await this.checkDockerAvailability());
    if (dockerAvailable && config.dockerImage) {
      return this.executeInDocker(config, code, input, submissionId);
    } else {
      return this.executeLocally(config, code, input, submissionId);
    }
  }

  private async executeOriginal(
    language: string,
    code: string,
    input: string,
    submissionId: string
  ): Promise<ExecutionResult> {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Check if Docker is available and configured
    const dockerAvailable =
      this.useDocker && (await this.checkDockerAvailability());

    if (dockerAvailable && config.dockerImage) {
      return this.executeInDocker(config, code, input, submissionId);
    } else {
      return this.executeLocally(config, code, input, submissionId);
    }
  }
}

// Singleton instance - Enable Docker in production
const isProduction = process.env.NODE_ENV === "production";
export const codeExecutor = new CodeExecutor("./tmp", isProduction);
