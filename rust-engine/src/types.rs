use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Execution request from the TypeScript API
#[derive(Debug, Deserialize, Clone)]
pub struct ExecutionRequest {
    pub id: String,
    pub language: String,
    pub language_id: Option<u32>,
    pub source_code: String,
    pub stdin: Option<String>,
    pub compiler_options: Option<String>,
    pub command_line_arguments: Option<String>,
    
    // Resource limits
    pub cpu_time_limit: Option<f64>,
    pub cpu_extra_time: Option<f64>,
    pub memory_limit: Option<u64>,
    pub wall_time_limit: Option<f64>,
    pub stack_limit: Option<u64>,
    pub max_processes_and_or_threads: Option<u32>,
    pub enable_per_process_and_thread_time_limit: Option<bool>,
    pub enable_per_process_and_thread_memory_limit: Option<bool>,
    pub max_file_size: Option<u64>,
    
    // Execution options
    pub redirect_stderr_to_stdout: Option<bool>,
    pub enable_network: Option<bool>,
    pub number_of_runs: Option<u32>,
    
    // Callback and files
    pub callback_url: Option<String>,
    pub additional_files: Option<String>, // Base64 encoded ZIP
}

/// Response when submitting execution
#[derive(Debug, Serialize)]
pub struct ExecutionResponse {
    pub id: String,
    pub status: String,
    pub message: String,
}

/// Current execution status
#[derive(Debug, Serialize)]
pub struct ExecutionStatus {
    pub id: String,
    pub status: ExecutionState,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub progress: Option<String>,
}

/// Execution result with output
#[derive(Debug, Serialize, Clone)]
pub struct ExecutionResult {
    pub id: String,
    pub status: ExecutionState,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub compile_output: Option<String>,
    pub exit_code: Option<i32>,
    pub signal: Option<String>,
    pub time: Option<f64>,
    pub memory: Option<u64>,
    pub created_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}

/// Execution states
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ExecutionState {
    #[serde(rename = "queued")]
    Queued,
    #[serde(rename = "processing")]
    Processing,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "compilation_error")]
    CompilationError,
    #[serde(rename = "runtime_error")]
    RuntimeError,
    #[serde(rename = "time_limit_exceeded")]
    TimeLimitExceeded,
    #[serde(rename = "memory_limit_exceeded")]
    MemoryLimitExceeded,
    #[serde(rename = "cancelled")]
    Cancelled,
    #[serde(rename = "internal_error")]
    InternalError,
}

/// Language information
#[derive(Debug, Serialize)]
pub struct LanguageInfo {
    pub id: u32,
    pub name: String,
    pub version: String,
    pub compile_cmd: Option<String>,
    pub run_cmd: String,
}

/// Health check response
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub engine: String,
    pub version: String,
    pub timestamp: DateTime<Utc>,
}

/// Engine statistics
#[derive(Debug, Serialize)]
pub struct EngineStats {
    pub total_executions: u64,
    pub active_executions: u64,
    pub queued_executions: u64,
    pub completed_executions: u64,
    pub failed_executions: u64,
    pub average_execution_time: f64,
    pub system_load: f64,
    pub memory_usage: u64,
    pub uptime_seconds: u64,
}

/// Cancel response
#[derive(Debug, Serialize)]
pub struct CancelResponse {
    pub cancelled: bool,
    pub message: String,
}

/// Internal execution job
#[derive(Debug, Clone)]
pub struct ExecutionJob {
    pub id: String,
    pub request: ExecutionRequest,
    pub status: ExecutionState,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub result: Option<ExecutionResult>,
}

/// Resource limits for execution
#[derive(Debug, Clone)]
pub struct ResourceLimits {
    pub cpu_time: f64,          // seconds
    pub cpu_extra_time: f64,    // extra time for cleanup
    pub memory: u64,            // bytes
    pub wall_time: f64,         // seconds
    pub stack_limit: u64,       // bytes
    pub file_size: u64,         // bytes
    pub processes: u32,         // max processes/threads
    pub enable_per_process_time_limit: bool,
    pub enable_per_process_memory_limit: bool,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            cpu_time: 5.0,
            cpu_extra_time: 0.5,
            memory: 256 * 1024 * 1024, // 256MB
            wall_time: 10.0,
            stack_limit: 64 * 1024 * 1024, // 64MB
            file_size: 1024 * 1024,     // 1MB
            processes: 1,
            enable_per_process_time_limit: false,
            enable_per_process_memory_limit: true,
        }
    }
}

impl ResourceLimits {
    /// Create resource limits from execution request
    pub fn from_request(req: &ExecutionRequest) -> Self {
        Self {
            cpu_time: req.cpu_time_limit.unwrap_or(5.0),
            cpu_extra_time: req.cpu_extra_time.unwrap_or(0.5),
            memory: req.memory_limit.unwrap_or(256 * 1024 * 1024),
            wall_time: req.wall_time_limit.unwrap_or(10.0),
            stack_limit: req.stack_limit.unwrap_or(64 * 1024 * 1024),
            file_size: req.max_file_size.unwrap_or(1024 * 1024),
            processes: req.max_processes_and_or_threads.unwrap_or(1),
            enable_per_process_time_limit: req.enable_per_process_and_thread_time_limit.unwrap_or(false),
            enable_per_process_memory_limit: req.enable_per_process_and_thread_memory_limit.unwrap_or(true),
        }
    }
}

/// Execution options
#[derive(Debug, Clone)]
pub struct ExecutionOptions {
    pub redirect_stderr_to_stdout: bool,
    pub enable_network: bool,
    pub number_of_runs: u32,
    pub stop_on_first_failure: bool,
}

impl Default for ExecutionOptions {
    fn default() -> Self {
        Self {
            redirect_stderr_to_stdout: false,
            enable_network: false,
            number_of_runs: 1,
            stop_on_first_failure: true,
        }
    }
}

impl ExecutionOptions {
    /// Create execution options from request
    pub fn from_request(req: &ExecutionRequest) -> Self {
        Self {
            redirect_stderr_to_stdout: req.redirect_stderr_to_stdout.unwrap_or(false),
            enable_network: req.enable_network.unwrap_or(false),
            number_of_runs: req.number_of_runs.unwrap_or(1),
            stop_on_first_failure: true, // Default behavior
        }
    }
}

/// Execution metrics
#[derive(Debug, Default)]
pub struct ExecutionMetrics {
    pub cpu_time: f64,
    pub memory_peak: u64,
    pub wall_time: f64,
    pub exit_code: i32,
    pub signal: Option<String>,
}
