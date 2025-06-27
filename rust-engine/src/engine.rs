use crate::executor::CodeExecutor;
use crate::queue::ExecutionQueue;
use crate::types::*;
use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};
use chrono::Utc;

/// Main execution engine that coordinates everything
pub struct ExecutionEngine {
    queue: ExecutionQueue,
    executor: CodeExecutor,
    jobs: Arc<RwLock<HashMap<String, ExecutionJob>>>,
    stats: Arc<RwLock<EngineStats>>,
    start_time: chrono::DateTime<Utc>,
}

impl ExecutionEngine {
    /// Create a new execution engine
    pub async fn new() -> Result<Self> {
        info!("🔧 Initializing Rust execution engine");
        
        let queue = ExecutionQueue::new().await?;
        let executor = CodeExecutor::new()?;
        let jobs = Arc::new(RwLock::new(HashMap::new()));
        let stats = Arc::new(RwLock::new(EngineStats::default()));
        let start_time = Utc::now();
        
        let engine = Self {
            queue,
            executor,
            jobs,
            stats,
            start_time,
        };
        
        // Start the worker loop
        engine.start_worker().await;
        
        info!("✅ Rust execution engine initialized");
        Ok(engine)
    }
    
    /// Submit a new execution request
    pub async fn submit_execution(&self, request: ExecutionRequest) -> Result<ExecutionResponse> {
        info!("📝 Submitting execution: {}", request.id);
        
        let job = ExecutionJob {
            id: request.id.clone(),
            request,
            status: ExecutionState::Queued,
            created_at: Utc::now(),
            started_at: None,
            finished_at: None,
            result: None,
        };
        
        // Store the job
        {
            let mut jobs = self.jobs.write().await;
            jobs.insert(job.id.clone(), job.clone());
        }
        
        // Store the job ID before moving the job
        let job_id = job.id.clone();
        
        // Queue for execution
        self.queue.enqueue(job).await?;
        
        // Update stats
        {
            let mut stats = self.stats.write().await;
            stats.total_executions += 1;
            stats.queued_executions += 1;
        }
        
        Ok(ExecutionResponse {
            id: job_id,
            status: "queued".to_string(),
            message: "Execution queued successfully".to_string(),
        })
    }
    
    /// Get execution status
    pub async fn get_status(&self, id: &str) -> Result<Option<ExecutionStatus>> {
        let jobs = self.jobs.read().await;
        if let Some(job) = jobs.get(id) {
            Ok(Some(ExecutionStatus {
                id: job.id.clone(),
                status: job.status.clone(),
                created_at: job.created_at,
                started_at: job.started_at,
                finished_at: job.finished_at,
                progress: None, // Could add progress tracking later
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Get execution result
    pub async fn get_result(&self, id: &str, include_output: bool) -> Result<Option<ExecutionResult>> {
        let jobs = self.jobs.read().await;
        if let Some(job) = jobs.get(id) {
            if let Some(mut result) = job.result.clone() {
                if !include_output {
                    result.stdout = None;
                    result.stderr = None;
                    result.compile_output = None;
                }
                Ok(Some(result))
            } else {
                // Job exists but no result yet
                Ok(Some(ExecutionResult {
                    id: job.id.clone(),
                    status: job.status.clone(),
                    stdout: None,
                    stderr: None,
                    compile_output: None,
                    exit_code: None,
                    signal: None,
                    time: None,
                    memory: None,
                    created_at: job.created_at,
                    finished_at: job.finished_at,
                }))
            }
        } else {
            Ok(None)
        }
    }
    
    /// Cancel execution
    pub async fn cancel_execution(&self, id: &str) -> Result<bool> {
        info!("🛑 Cancelling execution: {}", id);
        
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(id) {
            if matches!(job.status, ExecutionState::Queued | ExecutionState::Processing | ExecutionState::Running) {
                job.status = ExecutionState::Cancelled;
                job.finished_at = Some(Utc::now());
                
                // TODO: Actually kill the process if running
                // self.executor.kill_process(id).await?;
                
                Ok(true)
            } else {
                Ok(false)
            }
        } else {
            Ok(false)
        }
    }

    /// Get engine statistics
    pub async fn get_stats(&self) -> Result<EngineStats> {
        let stats = self.stats.read().await;
        let mut current_stats = stats.clone();
        // Update uptime
        current_stats.uptime_seconds = (Utc::now() - self.start_time).num_seconds() as u64;
        
        // Update system metrics
        let sys = sysinfo::System::new_all();
        current_stats.system_load = sysinfo::System::load_average().one as f64;
        current_stats.memory_usage = sys.used_memory();
        
        // Count active executions
        let jobs = self.jobs.read().await;
        current_stats.active_executions = jobs.values()
            .filter(|job| matches!(job.status, ExecutionState::Processing | ExecutionState::Running))
            .count() as u64;
        
        current_stats.queued_executions = jobs.values()
            .filter(|job| matches!(job.status, ExecutionState::Queued))
            .count() as u64;
        
        Ok(current_stats)
    }
        
    /// Start the worker loop to process queued jobs
    async fn start_worker(&self) {
        let queue = self.queue.clone();
        let executor = self.executor.clone();
        let jobs = Arc::clone(&self.jobs);
        let stats = Arc::clone(&self.stats);
        
        tokio::spawn(async move {
            info!("🔄 Starting execution worker loop");
            
            loop {
                match queue.dequeue().await {
                    Ok(Some(mut job)) => {
                        info!("🚀 Processing execution: {}", job.id);
                        
                        // Update job status
                        job.status = ExecutionState::Processing;
                        job.started_at = Some(Utc::now());
                        
                        {
                            let mut jobs_map = jobs.write().await;
                            jobs_map.insert(job.id.clone(), job.clone());
                        }
                        
                        // Execute the code
                        match executor.execute(&job.request).await {
                            Ok(result) => {
                                info!("✅ Execution completed: {}", job.id);
                                job.status = result.status.clone();
                                job.finished_at = Some(Utc::now());
                                job.result = Some(result);
                                
                                // Update stats
                                {
                                    let mut stats_map = stats.write().await;
                                    stats_map.completed_executions += 1;
                                }
                            }
                            Err(err) => {
                                error!("❌ Execution failed: {} - {}", job.id, err);
                                job.status = ExecutionState::InternalError;
                                job.finished_at = Some(Utc::now());
                                
                                // Update stats
                                {
                                    let mut stats_map = stats.write().await;
                                    stats_map.failed_executions += 1;
                                }
                            }
                        }
                        
                        // Store the updated job
                        {
                            let mut jobs_map = jobs.write().await;
                            jobs_map.insert(job.id.clone(), job);
                        }
                    }
                    Ok(None) => {
                        // No jobs in queue, wait a bit
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                    Err(err) => {
                        error!("❌ Queue error: {}", err);
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    }
                }
            }
        });
    }
}

impl Default for EngineStats {
    fn default() -> Self {
        Self {
            total_executions: 0,
            active_executions: 0,
            queued_executions: 0,
            completed_executions: 0,
            failed_executions: 0,
            average_execution_time: 0.0,
            system_load: 0.0,
            memory_usage: 0,
            uptime_seconds: 0,
        }
    }
}
