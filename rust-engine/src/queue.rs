use crate::types::*;
use anyhow::Result;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Simple in-memory queue for execution jobs
/// In production, this would be backed by Redis
#[derive(Clone)]
pub struct ExecutionQueue {
    queue: Arc<Mutex<VecDeque<ExecutionJob>>>,
}

impl ExecutionQueue {
    /// Create a new execution queue
    pub async fn new() -> Result<Self> {
        Ok(Self {
            queue: Arc::new(Mutex::new(VecDeque::new())),
        })
    }
    
    /// Add a job to the queue
    pub async fn enqueue(&self, job: ExecutionJob) -> Result<()> {
        let mut queue = self.queue.lock().await;
        queue.push_back(job);
        Ok(())
    }
    
    /// Get the next job from the queue
    pub async fn dequeue(&self) -> Result<Option<ExecutionJob>> {
        let mut queue = self.queue.lock().await;
        Ok(queue.pop_front())
    }
    
    /// Get queue size
    pub async fn size(&self) -> usize {
        let queue = self.queue.lock().await;
        queue.len()
    }
    
    /// Clear the queue
    pub async fn clear(&self) {
        let mut queue = self.queue.lock().await;
        queue.clear();
    }
}
