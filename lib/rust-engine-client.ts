/**
 * Rust Engine Client for LabForCode
 *
 * This module handles communication with the high-performance Rust execution engine.
 * The Rust engine provides better performance, security, and resource management
 * for code execution tasks.
 */

export interface RustEngineRequest {
  id: string;
  language: string;
  language_id?: number;
  source_code: string;
  stdin?: string;
  compiler_options?: string;
  command_line_arguments?: string;

  // Resource limits
  cpu_time_limit?: number;
  cpu_extra_time?: number;
  memory_limit?: number;
  wall_time_limit?: number;
  stack_limit?: number;
  max_processes_and_or_threads?: number;
  enable_per_process_and_thread_time_limit?: boolean;
  enable_per_process_and_thread_memory_limit?: boolean;
  max_file_size?: number;

  // Execution options
  redirect_stderr_to_stdout?: boolean;
  enable_network?: boolean;
  number_of_runs?: number;

  // Callback and files
  callback_url?: string;
  additional_files?: string;
}

export interface RustEngineResponse {
  id: string;
  status: string;
  message: string;
}

export interface RustEngineResult {
  id: string;
  status: string;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  exit_code?: number;
  signal?: string;
  time?: number;
  memory?: number;
  created_at: string;
  finished_at?: string;
}

export class RustEngineClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.RUST_ENGINE_URL || "http://rust-engine:8080";
  }

  /**
   * Submit code for execution to the Rust engine
   */
  async submitExecution(
    request: RustEngineRequest
  ): Promise<RustEngineResponse> {
    const response = await fetch(`${this.baseUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Rust engine submission failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get execution status from the Rust engine
   */
  async getExecutionStatus(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/status/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get execution result from the Rust engine
   */
  async getExecutionResult(
    id: string,
    includeOutput: boolean = true
  ): Promise<RustEngineResult | null> {
    const url = `${this.baseUrl}/result/${id}?include_output=${includeOutput}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get result: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel execution in the Rust engine
   */
  async cancelExecution(
    id: string
  ): Promise<{ cancelled: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/cancel/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel execution: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get Rust engine statistics
   */
  async getEngineStats(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/stats`);

    if (!response.ok) {
      throw new Error(`Failed to get engine stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if the Rust engine is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get supported languages from the Rust engine
   */
  async getSupportedLanguages(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/languages`);

    if (!response.ok) {
      throw new Error(
        `Failed to get supported languages: ${response.statusText}`
      );
    }

    return response.json();
  }
}

// Singleton instance
export const rustEngineClient = new RustEngineClient();
