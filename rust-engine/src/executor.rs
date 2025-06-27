use crate::sandbox::Sandbox;
use crate::types::*;
use anyhow::{anyhow, Result};
use chrono::Utc;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tempfile::TempDir;
use tokio::time::timeout;
use tracing::{debug, info, warn};

/// Code executor that handles different programming languages
pub struct CodeExecutor {
    languages: HashMap<String, LanguageConfig>,
    temp_base: PathBuf,
}

impl CodeExecutor {
    /// Create a new code executor
    pub fn new() -> Result<Self> {
        let temp_base = std::env::temp_dir().join("labforcode-rust");
        fs::create_dir_all(&temp_base)?;
        
        let mut languages = HashMap::new();
        
        // Python
        languages.insert("python".to_string(), LanguageConfig {
            id: 71,
            name: "Python 3".to_string(),
            source_file: "main.py".to_string(),
            compile_cmd: None,
            run_cmd: vec!["python3".to_string(), "main.py".to_string()],
            docker_image: Some("python:3.11-alpine".to_string()),
        });
        
        // JavaScript (Node.js)
        languages.insert("javascript".to_string(), LanguageConfig {
            id: 63,
            name: "JavaScript (Node.js)".to_string(),
            source_file: "main.js".to_string(),
            compile_cmd: None,
            run_cmd: vec!["node".to_string(), "main.js".to_string()],
            docker_image: Some("node:18-alpine".to_string()),
        });
        
        // C++
        languages.insert("cpp".to_string(), LanguageConfig {
            id: 54,
            name: "C++ (GCC)".to_string(),
            source_file: "main.cpp".to_string(),
            compile_cmd: Some(vec!["g++".to_string(), "-o".to_string(), "main".to_string(), "main.cpp".to_string(), "-std=c++17".to_string()]),
            run_cmd: vec!["./main".to_string()],
            docker_image: Some("gcc:latest".to_string()),
        });
        
        // C
        languages.insert("c".to_string(), LanguageConfig {
            id: 50,
            name: "C (GCC)".to_string(),
            source_file: "main.c".to_string(),
            compile_cmd: Some(vec!["gcc".to_string(), "-o".to_string(), "main".to_string(), "main.c".to_string(), "-std=c17".to_string(), "-lm".to_string()]),
            run_cmd: vec!["./main".to_string()],
            docker_image: Some("gcc:latest".to_string()),
        });
        
        // Java
        languages.insert("java".to_string(), LanguageConfig {
            id: 62,
            name: "Java (OpenJDK)".to_string(),
            source_file: "Main.java".to_string(),
            compile_cmd: Some(vec!["javac".to_string(), "Main.java".to_string()]),
            run_cmd: vec!["java".to_string(), "Main".to_string()],
            docker_image: Some("openjdk:17-alpine".to_string()),
        });
        
        // Go
        languages.insert("go".to_string(), LanguageConfig {
            id: 60,
            name: "Go".to_string(),
            source_file: "main.go".to_string(),
            compile_cmd: None,
            run_cmd: vec!["go".to_string(), "run".to_string(), "main.go".to_string()],
            docker_image: Some("golang:1.21-alpine".to_string()),
        });
        
        // Rust
        languages.insert("rust".to_string(), LanguageConfig {
            id: 73,
            name: "Rust".to_string(),
            source_file: "main.rs".to_string(),
            compile_cmd: Some(vec!["rustc".to_string(), "main.rs".to_string(), "-o".to_string(), "main".to_string()]),
            run_cmd: vec!["./main".to_string()],
            docker_image: Some("rust:1.70-alpine".to_string()),
        });
        
        Ok(Self {
            languages,
            temp_base,
        })
    }
    
    /// Execute code with advanced resource limits and options
    pub async fn execute(&self, request: &ExecutionRequest) -> Result<ExecutionResult> {
        let start_time = Instant::now();
        let created_at = Utc::now();
        
        info!("🚀 Executing {} code for {}", request.language, request.id);
        
        // Get language config
        let lang_config = self.languages.get(&request.language.to_lowercase())
            .or_else(|| self.languages.get(&request.language_id.unwrap_or(0).to_string()))
            .ok_or_else(|| anyhow!("Unsupported language: {}", request.language))?;
        
        // Create resource limits from request
        let limits = ResourceLimits::from_request(request);
        let options = ExecutionOptions::from_request(request);
        
        // Determine if we should run multiple times
        let num_runs = options.number_of_runs.max(1);
        let mut results = Vec::new();
        
        for run_index in 0..num_runs {
            debug!("Executing run {} of {}", run_index + 1, num_runs);
            
            let run_result = self.execute_single_run(
                request,
                lang_config,
                &limits,
                &options,
                run_index + 1,
            ).await?;
            
            results.push(run_result.clone());
            
            // If any run fails, we can decide whether to continue or stop
            if run_result.exit_code.unwrap_or(0) != 0 && options.stop_on_first_failure {
                warn!("Run {} failed, stopping remaining runs", run_index + 1);
                break;
            }
        }
        
        // Aggregate results from multiple runs
        let aggregated_result = self.aggregate_results(&request.id, results, created_at);
        
        let execution_time = start_time.elapsed().as_millis() as f64;
        info!("✅ Execution completed in {}ms", execution_time);
        
        Ok(aggregated_result)
    }
    
    /// Execute a single run of the code
    async fn execute_single_run(
        &self,
        request: &ExecutionRequest,
        lang_config: &LanguageConfig,
        limits: &ResourceLimits,
        options: &ExecutionOptions,
        _run_number: u32,
    ) -> Result<ExecutionResult> {
        // Create temporary directory for this execution
        let temp_dir = TempDir::new_in(&self.temp_base)?;
        let temp_path = temp_dir.path();
        
        // Write source code to file
        let source_path = temp_path.join(&lang_config.source_file);
        fs::write(&source_path, &request.source_code)?;
        
        // Handle additional files (ZIP extraction)
        if let Some(additional_files) = &request.additional_files {
            self.extract_additional_files(temp_path, additional_files)?;
        }
        
        // Create stdin file if provided
        let stdin_path = if let Some(stdin) = &request.stdin {
            if !stdin.is_empty() {
                let stdin_path = temp_path.join("input.txt");
                fs::write(&stdin_path, stdin)?;
                Some(stdin_path)
            } else {
                None
            }
        } else {
            None
        };
        
        let mut compile_output = None;
        
        // Compile if needed
        if let Some(compile_cmd) = &lang_config.compile_cmd {
            debug!("Compiling code...");
            let compile_result = self.run_command_with_limits(
                compile_cmd,
                temp_path,
                limits,
                None, // No stdin for compilation
                options,
            ).await?;
            
            compile_output = Some(format!("{}\n{}", compile_result.stdout, compile_result.stderr));
            
            if compile_result.exit_code != 0 {
                return Ok(ExecutionResult {
                    id: request.id.clone(),
                    status: ExecutionState::CompilationError,
                    stdout: Some(compile_result.stdout),
                    stderr: Some(compile_result.stderr),
                    compile_output,
                    exit_code: Some(compile_result.exit_code),
                    signal: None,
                    time: Some(compile_result.execution_time),
                    memory: Some(compile_result.memory_usage),
                    created_at: Utc::now(),
                    finished_at: Some(Utc::now()),
                });
            }
        }
        
        // Execute the program
        debug!("Running code...");
        let run_result = self.run_command_with_limits(
            &lang_config.run_cmd,
            temp_path,
            limits,
            stdin_path.as_deref(),
            options,
        ).await?;
        
        // Determine final status based on exit code and execution
        let status = if run_result.exit_code == 0 {
            ExecutionState::Completed
        } else if run_result.timed_out {
            ExecutionState::TimeLimitExceeded
        } else if run_result.memory_exceeded {
            ExecutionState::MemoryLimitExceeded
        } else {
            ExecutionState::RuntimeError
        };
        
        Ok(ExecutionResult {
            id: request.id.clone(),
            status,
            stdout: Some(run_result.stdout),
            stderr: Some(run_result.stderr),
            compile_output,
            exit_code: Some(run_result.exit_code),
            signal: run_result.signal,
            time: Some(run_result.execution_time),
            memory: Some(run_result.memory_usage),
            created_at: Utc::now(),
            finished_at: Some(Utc::now()),
        })
    }
    
    /// Run a command with resource limits and sandboxing
    async fn run_command_with_limits(
        &self,
        cmd_args: &[String],
        working_dir: &Path,
        limits: &ResourceLimits,
        stdin_file: Option<&Path>,
        options: &ExecutionOptions,
    ) -> Result<CommandResult> {
        if cmd_args.is_empty() {
            return Err(anyhow!("Empty command"));
        }
        
        let mut command = Command::new(&cmd_args[0]);
        command.args(&cmd_args[1..]);
        command.current_dir(working_dir);
        
        // Set up stdio
        command.stdout(Stdio::piped());
        
        if options.redirect_stderr_to_stdout {
            command.stderr(Stdio::piped()); // We'll merge manually
        } else {
            command.stderr(Stdio::piped());
        }
        
        if let Some(_stdin_file) = stdin_file {
            command.stdin(Stdio::piped());
        } else {
            command.stdin(Stdio::null());
        }
        
        // Apply sandbox limits
        let sandbox = Sandbox::new(limits.clone());
        sandbox.apply_limits(&mut command)?;
        
        // Start the process
        let start_time = Instant::now();
        let mut child = command.spawn()?;
        
        // Write stdin if provided
        if let Some(stdin_file) = stdin_file {
            if let Some(mut stdin) = child.stdin.take() {
                let stdin_data = fs::read(stdin_file)?;
                stdin.write_all(&stdin_data)?;
                drop(stdin); // Close stdin
            }
        }
        
        // Wait for completion with timeout
        let timeout_duration = Duration::from_secs_f64(limits.wall_time);
        let wait_result = timeout(timeout_duration, async move {
            tokio::task::spawn_blocking(move || {
                child.wait_with_output()
            }).await.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?
        }).await;
        
        let execution_time = start_time.elapsed().as_secs_f64();
        
        match wait_result {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                
                // Handle stderr redirection
                let (final_stdout, final_stderr) = if options.redirect_stderr_to_stdout {
                    (format!("{}{}", stdout, stderr), String::new())
                } else {
                    (stdout, stderr)
                };
                
                Ok(CommandResult {
                    stdout: final_stdout,
                    stderr: final_stderr,
                    exit_code: output.status.code().unwrap_or(-1),
                    signal: None, // TODO: Extract signal on Unix
                    execution_time,
                    memory_usage: 0, // TODO: Track memory usage
                    timed_out: false,
                    memory_exceeded: false,
                })
            }
            Ok(Err(e)) => Err(anyhow!("Process execution failed: {}", e)),
            Err(_) => {
                // Timeout occurred - process was killed by timeout mechanism
                Ok(CommandResult {
                    stdout: String::new(),
                    stderr: "Time limit exceeded".to_string(),
                    exit_code: -1,
                    signal: Some("SIGKILL".to_string()),
                    execution_time,
                    memory_usage: 0,
                    timed_out: true,
                    memory_exceeded: false,
                })
            }
        }
    }
    
    /// Extract additional files from base64 ZIP
    fn extract_additional_files(&self, temp_path: &Path, base64_zip: &str) -> Result<()> {
        use base64::{engine::general_purpose, Engine as _};
        use std::io::Cursor;
        use zip::ZipArchive;
        
        debug!("Extracting additional files from ZIP");
        
        // Decode base64
        let zip_data = general_purpose::STANDARD
            .decode(base64_zip)
            .map_err(|e| anyhow!("Failed to decode base64 ZIP: {}", e))?;
        
        // Create ZIP archive from bytes
        let cursor = Cursor::new(zip_data);
        let mut archive = ZipArchive::new(cursor)
            .map_err(|e| anyhow!("Failed to open ZIP archive: {}", e))?;
        
        // Extract all files
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| anyhow!("Failed to read ZIP entry {}: {}", i, e))?;
            
            let file_path = temp_path.join(file.name());
            
            // Create parent directories if needed
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent)?;
            }
            
            // Skip directories
            if file.is_dir() {
                continue;
            }
            
            // Extract file
            let mut extracted_file = fs::File::create(&file_path)
                .map_err(|e| anyhow!("Failed to create file {}: {}", file_path.display(), e))?;
            
            std::io::copy(&mut file, &mut extracted_file)
                .map_err(|e| anyhow!("Failed to extract file {}: {}", file_path.display(), e))?;
            
            debug!("Extracted file: {}", file_path.display());
        }
        
        info!("Successfully extracted {} files from ZIP", archive.len());
        Ok(())
    }
    
    /// Aggregate results from multiple runs
    fn aggregate_results(
        &self,
        id: &str,
        results: Vec<ExecutionResult>,
        created_at: chrono::DateTime<Utc>,
    ) -> ExecutionResult {
        if results.is_empty() {
            return ExecutionResult {
                id: id.to_string(),
                status: ExecutionState::InternalError,
                stdout: Some("No results".to_string()),
                stderr: Some("No execution results".to_string()),
                compile_output: None,
                exit_code: Some(-1),
                signal: None,
                time: Some(0.0),
                memory: Some(0),
                created_at,
                finished_at: Some(Utc::now()),
            };
        }
        
        if results.len() == 1 {
            return results.into_iter().next().unwrap();
        }
        
        // For multiple runs, aggregate the results
        let mut combined_stdout = String::new();
        let mut combined_stderr = String::new();
        let mut total_time = 0.0;
        let mut max_memory = 0;
        let mut final_status = ExecutionState::Completed;
        let mut final_exit_code = 0;
        
        for (i, result) in results.iter().enumerate() {
            if i > 0 {
                combined_stdout.push_str("\n--- Run ");
                combined_stdout.push_str(&(i + 1).to_string());
                combined_stdout.push_str(" ---\n");
            }
            
            if let Some(stdout) = &result.stdout {
                combined_stdout.push_str(stdout);
            }
            
            if let Some(stderr) = &result.stderr {
                if !stderr.is_empty() {
                    combined_stderr.push_str(&format!("Run {}: {}\n", i + 1, stderr));
                }
            }
            
            if let Some(time) = result.time {
                total_time += time;
            }
            
            if let Some(memory) = result.memory {
                max_memory = max_memory.max(memory);
            }
            
            // If any run failed, mark the overall status as failed
            if result.status != ExecutionState::Completed {
                final_status = result.status.clone();
                final_exit_code = result.exit_code.unwrap_or(-1);
            }
        }
        
        ExecutionResult {
            id: id.to_string(),
            status: final_status,
            stdout: Some(combined_stdout),
            stderr: Some(combined_stderr),
            compile_output: results[0].compile_output.clone(),
            exit_code: Some(final_exit_code),
            signal: None,
            time: Some(total_time),
            memory: Some(max_memory),
            created_at,
            finished_at: Some(Utc::now()),
        }
    }
}

/// Result of running a command
#[derive(Debug)]
struct CommandResult {
    stdout: String,
    stderr: String,
    exit_code: i32,
    signal: Option<String>,
    execution_time: f64,
    memory_usage: u64,
    timed_out: bool,
    memory_exceeded: bool,
}

/// Language configuration
#[derive(Debug, Clone)]
struct LanguageConfig {
    id: u32,
    name: String,
    source_file: String,
    compile_cmd: Option<Vec<String>>,
    run_cmd: Vec<String>,
    docker_image: Option<String>,
}