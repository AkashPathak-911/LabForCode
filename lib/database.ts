/**
 * CodeRunner Pro Database Module
 *
 * This is an ORIGINAL implementation built from scratch.
 * While it provides Judge0-compatible fields and APIs, it does NOT use
 * any Judge0 code, dependencies, or libraries.
 *
 * All code in this file is original and MIT licensed.
 */

import { Pool, PoolClient } from "pg";

export interface Submission {
  id: string;
  language_id?: number;
  language: string;
  source_code: string;
  stdin?: string;
  input?: string; // Backward compatibility
  code?: string; // Backward compatibility
  expected_output?: string;
  compiler_options?: string;
  command_line_arguments?: string;
  callback_url?: string;
  additional_files?: string; // Base64 encoded ZIP

  // Resource limits
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

  // Results
  status:
    | "queued"
    | "running"
    | "completed"
    | "error"
    | "timeout"
    | "accepted"
    | "wrong_answer"
    | "compilation_error"
    | "runtime_error"
    | "time_limit_exceeded"
    | "memory_limit_exceeded";
  stdout?: string;
  output?: string; // Backward compatibility
  stderr?: string;
  compile_output?: string;
  message?: string;
  exit_code?: number;
  exit_signal?: number;
  time?: number;
  execution_time?: number; // Backward compatibility
  wall_time?: number;
  memory?: number;
  memory_usage?: number; // Backward compatibility

  // Metadata
  token: string;
  created_at: string;
  finished_at?: string;
  completed_at?: string; // Backward compatibility
  share_id?: string;
  user_id?: string;
}

export interface Language {
  id: number;
  name: string;
  is_archived?: boolean;
  source_file?: string;
  compile_cmd?: string;
  run_cmd?: string;
}

export interface Status {
  id: number;
  description: string;
}

export interface SystemInfo {
  [key: string]: string;
}

export interface ConfigInfo {
  enable_wait_result: boolean;
  enable_compiler_options: boolean;
  allowed_languages_for_compile_options: number[];
  enable_command_line_arguments: boolean;
  enable_submission_delete: boolean;
  max_queue_size: number;
  cpu_time_limit: number;
  max_cpu_time_limit: number;
  cpu_extra_time: number;
  max_cpu_extra_time: number;
  wall_time_limit: number;
  max_wall_time_limit: number;
  memory_limit: number;
  max_memory_limit: number;
  stack_limit: number;
  max_stack_limit: number;
  max_processes_and_or_threads: number;
  max_max_processes_and_or_threads: number;
  enable_per_process_and_thread_time_limit: boolean;
  allow_enable_per_process_and_thread_time_limit: boolean;
  enable_per_process_and_thread_memory_limit: boolean;
  allow_enable_per_process_and_thread_memory_limit: boolean;
  max_file_size: number;
  max_max_file_size: number;
  enable_network: boolean;
  allow_enable_network: boolean;
  number_of_runs: number;
  max_number_of_runs: number;
}

class DatabaseService {
  private pool: Pool | null = null;
  private isConnected = false;

  constructor() {
    this.initializePool();
  }

  private initializePool() {
    try {
      const connectionString =
        process.env.DATABASE_URL ||
        "postgresql://coderunner:password123@localhost:5432/coderunner";

      this.pool = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on("error", (err) => {
        console.error("Unexpected error on idle client", err);
      });

      console.log("Database pool initialized");
    } catch (error) {
      console.error("Failed to initialize database pool:", error);
    }
  }

  async connect(): Promise<boolean> {
    if (!this.pool) {
      console.error("Database pool not initialized");
      return false;
    }

    try {
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();
      this.isConnected = true;
      console.log("Database connected successfully");
      return true;
    } catch (error) {
      console.error("Database connection failed:", error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log("Database disconnected");
    }
  }

  private async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error("Database not connected");
    }

    // Auto-connect if not connected
    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error("Database not connected");
      }
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }
  // Submission operations
  async createSubmission(
    submission: Omit<Submission, "created_at" | "token">
  ): Promise<Submission> {
    const token = require("uuid").v4();
    const query = `
      INSERT INTO submissions (
        id, token, language, source_code, stdin, expected_output,
        compiler_options, command_line_arguments, callback_url, additional_files,
        cpu_time_limit, cpu_extra_time, wall_time_limit, memory_limit,
        stack_limit, max_processes_and_or_threads, enable_per_process_and_thread_time_limit,
        enable_per_process_and_thread_memory_limit, max_file_size, redirect_stderr_to_stdout,
        enable_network, number_of_runs, status, user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *, created_at
    `;
    const values = [
      submission.id,
      token,
      submission.language,
      submission.source_code || submission.code,
      submission.stdin || submission.input || "",
      submission.expected_output || null,
      submission.compiler_options || null,
      submission.command_line_arguments || null,
      submission.callback_url || null,
      submission.additional_files || null,
      submission.cpu_time_limit || 2.0,
      submission.cpu_extra_time || 0.5,
      submission.wall_time_limit || 5.0,
      submission.memory_limit || 128000,
      submission.stack_limit || 64000,
      submission.max_processes_and_or_threads || 60,
      submission.enable_per_process_and_thread_time_limit || false,
      submission.enable_per_process_and_thread_memory_limit || true,
      submission.max_file_size || 1024,
      submission.redirect_stderr_to_stdout || false,
      submission.enable_network !== undefined
        ? submission.enable_network
        : true,
      submission.number_of_runs || 1,
      submission.status || "queued",
      submission.user_id || null,
    ];

    const result = await this.query(query, values);
    return this.mapToSubmission(result.rows[0]);
  }
  private mapToSubmission(row: any): Submission {
    return {
      id: row.id,
      token: row.token || row.id,
      language: row.language,
      language_id: row.language_id,
      source_code: row.source_code,
      stdin: row.stdin,
      expected_output: row.expected_output,
      compiler_options: row.compiler_options,
      command_line_arguments: row.command_line_arguments,
      callback_url: row.callback_url,
      additional_files: row.additional_files,
      cpu_time_limit: row.cpu_time_limit,
      cpu_extra_time: row.cpu_extra_time,
      wall_time_limit: row.wall_time_limit,
      memory_limit: row.memory_limit,
      stack_limit: row.stack_limit,
      max_processes_and_or_threads: row.max_processes_and_or_threads,
      enable_per_process_and_thread_time_limit:
        row.enable_per_process_and_thread_time_limit,
      enable_per_process_and_thread_memory_limit:
        row.enable_per_process_and_thread_memory_limit,
      max_file_size: row.max_file_size,
      redirect_stderr_to_stdout: row.redirect_stderr_to_stdout,
      enable_network: row.enable_network,
      number_of_runs: row.number_of_runs,
      status: row.status,
      stdout: row.stdout,
      stderr: row.stderr,
      compile_output: row.compile_output,
      message: row.message,
      exit_code: row.exit_code,
      exit_signal: row.exit_signal,
      time: row.time,
      wall_time: row.wall_time,
      memory: row.memory,
      created_at: row.created_at,
      finished_at: row.finished_at,
      share_id: row.share_id,
      user_id: row.user_id,
      // Backward compatibility mappings
      code: row.source_code,
      input: row.stdin,
      output: row.stdout,
      execution_time: row.time ? Math.round(row.time * 1000) : undefined,
      memory_usage: row.memory ? Math.round(row.memory * 1024) : undefined,
      completed_at: row.finished_at,
    };
  }

  async createBatchSubmissions(
    submissions: Omit<Submission, "created_at" | "token">[]
  ): Promise<Submission[]> {
    const results: Submission[] = [];
    for (const submission of submissions) {
      try {
        const result = await this.createSubmission(submission);
        results.push(result);
      } catch (error) {
        results.push({
          ...submission,
          token: require("uuid").v4(),
          status: "error" as const,
          message: error instanceof Error ? error.message : "Unknown error",
          created_at: new Date().toISOString(),
        });
      }
    }
    return results;
  }
  async getSubmission(id: string): Promise<Submission | null> {
    const query = "SELECT * FROM submissions WHERE id::text = $1 OR token = $1";
    const result = await this.query(query, [id]);
    return result.rows[0] ? this.mapToSubmission(result.rows[0]) : null;
  }

  async getBatchSubmissions(tokens: string[]): Promise<Submission[]> {
    if (tokens.length === 0) return [];
    const placeholders = tokens.map((_, i) => `$${i + 1}`).join(",");
    const query = `SELECT * FROM submissions WHERE token IN (${placeholders}) ORDER BY created_at DESC`;
    const result = await this.query(query, tokens);
    return result.rows.map((row: any) => this.mapToSubmission(row));
  }

  async deleteSubmission(id: string): Promise<Submission | null> {
    const submission = await this.getSubmission(id);
    if (!submission) return null;

    if (submission.status === "queued" || submission.status === "running") {
      throw new Error(
        `submission cannot be deleted because its status is ${submission.status}`
      );
    }

    const query =
      "DELETE FROM submissions WHERE id::text = $1 OR token = $1 RETURNING *";
    const result = await this.query(query, [id]);
    return result.rows[0] ? this.mapToSubmission(result.rows[0]) : null;
  }

  async updateSubmission(
    id: string,
    updates: Partial<Submission>
  ): Promise<Submission | null> {
    // Remove finished_at from updates if it exists, we'll handle it separately
    const { finished_at, ...cleanUpdates } = updates;

    const setClause = Object.keys(cleanUpdates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(", ");

    // Only add the finished_at logic if we're not explicitly setting it
    const finishedAtClause = finished_at
      ? `finished_at = $${Object.keys(cleanUpdates).length + 2}`
      : `finished_at = CASE WHEN status IN ('completed', 'error', 'timeout', 'accepted', 'runtime_error') THEN NOW() ELSE finished_at END`;

    const query = `
      UPDATE submissions 
      SET ${setClause}${setClause ? ", " : ""}${finishedAtClause}
      WHERE id::text = $1 
      RETURNING *
    `;

    const values = finished_at
      ? [id, ...Object.values(cleanUpdates), finished_at]
      : [id, ...Object.values(cleanUpdates)];

    const result = await this.query(query, values);
    return result.rows[0] ? this.mapToSubmission(result.rows[0]) : null;
  }
  async getSubmissions(
    limit: number = 50,
    offset: number = 0,
    fields?: string[]
  ): Promise<{
    submissions: Submission[];
    meta: {
      current_page: number;
      next_page: number | null;
      prev_page: number | null;
      total_pages: number;
      total_count: number;
    };
  }> {
    // Get total count
    const countResult = await this.query(
      "SELECT COUNT(*) as total FROM submissions"
    );
    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    const selectFields = fields && fields.length > 0 ? fields.join(", ") : "*";
    const query = `
      SELECT ${selectFields} FROM submissions 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await this.query(query, [limit, offset]);

    return {
      submissions: result.rows.map((row: any) => this.mapToSubmission(row)),
      meta: {
        current_page: currentPage,
        next_page: currentPage < totalPages ? currentPage + 1 : null,
        prev_page: currentPage > 1 ? currentPage - 1 : null,
        total_pages: totalPages,
        total_count: totalCount,
      },
    };
  }

  async getSubmissionsByStatus(status: string): Promise<Submission[]> {
    const query =
      "SELECT * FROM submissions WHERE status = $1 ORDER BY created_at ASC";
    const result = await this.query(query, [status]);
    return result.rows;
  }

  async getSubmissionByShareId(shareId: string): Promise<Submission | null> {
    const query = "SELECT * FROM submissions WHERE share_id = $1";
    const result = await this.query(query, [shareId]);
    return result.rows[0] || null;
  }

  async setShareId(id: string, shareId: string): Promise<boolean> {
    const query = "UPDATE submissions SET share_id = $1 WHERE id::text = $2";
    const result = await this.query(query, [shareId, id]);
    return result.rowCount > 0;
  }
  // Language operations
  async getLanguages(): Promise<Language[]> {
    // Mock Judge0 languages for now - in real implementation this would be from DB
    return [
      { id: 45, name: "Assembly (NASM 2.14.02)" },
      { id: 46, name: "Bash (5.0.0)" },
      { id: 48, name: "C (GCC 7.4.0)" },
      { id: 52, name: "C++ (GCC 7.4.0)" },
      { id: 51, name: "C# (Mono 6.6.0.161)" },
      { id: 62, name: "Java (OpenJDK 13.0.1)" },
      { id: 63, name: "JavaScript (Node.js 12.14.0)" },
      { id: 70, name: "Python (2.7.17)" },
      { id: 71, name: "Python (3.8.1)" },
      { id: 72, name: "Ruby (2.7.0)" },
      { id: 73, name: "Rust (1.40.0)" },
      { id: 74, name: "TypeScript (3.7.4)" },
      { id: 60, name: "Go (1.13.5)" },
    ];
  }

  async getLanguage(id: number): Promise<Language | null> {
    const languages = await this.getLanguages();
    return languages.find((lang) => lang.id === id) || null;
  }

  async getAllLanguages(): Promise<Language[]> {
    const languages = await this.getLanguages();
    return languages.map((lang) => ({ ...lang, is_archived: false }));
  }

  // Status operations
  async getStatuses(): Promise<Status[]> {
    return [
      { id: 1, description: "In Queue" },
      { id: 2, description: "Processing" },
      { id: 3, description: "Accepted" },
      { id: 4, description: "Wrong Answer" },
      { id: 5, description: "Time Limit Exceeded" },
      { id: 6, description: "Compilation Error" },
      { id: 7, description: "Runtime Error (SIGSEGV)" },
      { id: 8, description: "Runtime Error (SIGXFSZ)" },
      { id: 9, description: "Runtime Error (SIGFPE)" },
      { id: 10, description: "Runtime Error (SIGABRT)" },
      { id: 11, description: "Runtime Error (NZEC)" },
      { id: 12, description: "Runtime Error (Other)" },
      { id: 13, description: "Internal Error" },
      { id: 14, description: "Exec Format Error" },
    ];
  }

  // System and configuration info
  async getSystemInfo(): Promise<SystemInfo> {
    const cpuInfo = require("os").cpus();
    const memInfo = require("os").totalmem();
    const freeMemInfo = require("os").freemem();

    return {
      Architecture: require("os").arch(),
      "CPU op-mode(s)": "32-bit, 64-bit",
      "Byte Order": require("os").endianness(),
      "CPU(s)": cpuInfo.length.toString(),
      "Model name": cpuInfo[0]?.model || "Unknown",
      Mem: Math.round(memInfo / 1024 / 1024 / 1024) + "G",
      Free: Math.round(freeMemInfo / 1024 / 1024 / 1024) + "G",
    };
  }

  async getConfigInfo(): Promise<ConfigInfo> {
    return {
      enable_wait_result: true,
      enable_compiler_options: true,
      allowed_languages_for_compile_options: [],
      enable_command_line_arguments: true,
      enable_submission_delete: true,
      max_queue_size: 100,
      cpu_time_limit: 2,
      max_cpu_time_limit: 15,
      cpu_extra_time: 0.5,
      max_cpu_extra_time: 2,
      wall_time_limit: 5,
      max_wall_time_limit: 20,
      memory_limit: 128000,
      max_memory_limit: 256000,
      stack_limit: 64000,
      max_stack_limit: 128000,
      max_processes_and_or_threads: 60,
      max_max_processes_and_or_threads: 120,
      enable_per_process_and_thread_time_limit: false,
      allow_enable_per_process_and_thread_time_limit: true,
      enable_per_process_and_thread_memory_limit: true,
      allow_enable_per_process_and_thread_memory_limit: true,
      max_file_size: 1024,
      max_max_file_size: 4096,
      enable_network: true,
      allow_enable_network: true,
      number_of_runs: 1,
      max_number_of_runs: 20,
    };
  }
  // Statistics
  async getStatistics(): Promise<any> {
    try {
      const submissionsCount = await this.query(
        "SELECT COUNT(*) as total FROM submissions"
      );
      const languageStats = await this.query(`
        SELECT language, COUNT(*) as count 
        FROM submissions 
        GROUP BY language 
        ORDER BY count DESC
        LIMIT 10
      `);

      return {
        submissions: parseInt(submissionsCount.rows[0]?.total || "0"),
        languages: languageStats.rows || [],
        timestamp: new Date().toISOString(),
        status: "success",
      };
    } catch (error) {
      console.error("Error in getStatistics:", error);
      // Return default values if there's an error
      return {
        submissions: 0,
        languages: [],
        timestamp: new Date().toISOString(),
        status: "error",
        error: error instanceof Error ? error.message : "Database error",
      };
    }
  }

  // Workers info
  async getWorkers(): Promise<any[]> {
    return [
      {
        queue: "default",
        size: 0,
        available: 1,
        idle: 1,
        working: 0,
        paused: 0,
        failed: 0,
      },
    ];
  }

  // Statistics
  async getSubmissionStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeouts,
        AVG(execution_time) as avg_execution_time,
        language,
        COUNT(*) as language_count
      FROM submissions 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY language
      ORDER BY language_count DESC
    `;
    const result = await this.query(query);
    return result.rows;
  }

  // Cleanup old submissions
  async cleanupOldSubmissions(daysOld: number = 7): Promise<number> {
    const query = `
      DELETE FROM submissions 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      AND status IN ('completed', 'error', 'timeout')
    `;
    const result = await this.query(query);
    return result.rowCount;
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    connected: boolean;
  }> {
    try {
      const result = await this.query("SELECT NOW() as timestamp");
      return {
        status: "healthy",
        timestamp: result.rows[0].timestamp,
        connected: this.isConnected,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        connected: false,
      };
    }
  }

  async createSubmissionWithToken(
    submission: Omit<Submission, "created_at" | "token">,
    token: string
  ): Promise<Submission> {
    const query = `
      INSERT INTO submissions (
        id, token, language, source_code, stdin, expected_output,
        compiler_options, command_line_arguments, callback_url, additional_files,
        cpu_time_limit, cpu_extra_time, wall_time_limit, memory_limit,
        stack_limit, max_processes_and_or_threads, enable_per_process_and_thread_time_limit,
        enable_per_process_and_thread_memory_limit, max_file_size, redirect_stderr_to_stdout,
        enable_network, number_of_runs, status, user_id, language_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *, created_at
    `;
    const values = [
      submission.id,
      token,
      submission.language,
      submission.source_code || submission.code,
      submission.stdin || submission.input || "",
      submission.expected_output || null,
      submission.compiler_options || null,
      submission.command_line_arguments || null,
      submission.callback_url || null,
      submission.additional_files || null,
      submission.cpu_time_limit || 2.0,
      submission.cpu_extra_time || 0.5,
      submission.wall_time_limit || 5.0,
      submission.memory_limit || 128000,
      submission.stack_limit || 64000,
      submission.max_processes_and_or_threads || 60,
      submission.enable_per_process_and_thread_time_limit || false,
      submission.enable_per_process_and_thread_memory_limit || true,
      submission.max_file_size || 1024,
      submission.redirect_stderr_to_stdout || false,
      submission.enable_network !== undefined
        ? submission.enable_network
        : true,
      submission.number_of_runs || 1,
      submission.status || "queued",
      submission.user_id || null,
      submission.language_id || null,
    ];

    const result = await this.query(query, values);
    return this.mapToSubmission(result.rows[0]);
  }
}

// Singleton instance
export const database = new DatabaseService();
export const db = database; // Backward compatibility alias

// Initialize database connection on startup (only in runtime, not during build)
if (
  typeof window === "undefined" &&
  process.env.NODE_ENV !== "development" &&
  !process.env.NEXT_PHASE
) {
  // Server-side only and not during build
  database.connect().catch((error) => {
    console.warn(
      "Database connection failed during initialization:",
      error.message
    );
  });
}
