use crate::types::ResourceLimits;
use anyhow::Result;
use std::process::Command;
use tracing::warn;

/// Sandbox for securing code execution
pub struct Sandbox {
    limits: ResourceLimits,
}

impl Sandbox {
    /// Create a new sandbox with the given limits
    pub fn new(limits: ResourceLimits) -> Self {
        Self { limits }
    }
    
    /// Apply security and resource limits to a command
    pub fn apply_limits(&self, command: &mut Command) -> Result<()> {
        // On Unix systems, we would use:
        // - setrlimit for resource limits
        // - chroot/namespaces for isolation
        // - seccomp for syscall filtering
        
        #[cfg(unix)]
        {
            self.apply_unix_limits(command)?;
        }
        
        #[cfg(windows)]
        {
            self.apply_windows_limits(command)?;
        }
        
        Ok(())
    }
    
    #[cfg(unix)]
    fn apply_unix_limits(&self, command: &mut Command) -> Result<()> {
        use std::os::unix::process::CommandExt;
        
        // Apply resource limits using setrlimit
        let limits = self.limits.clone();
        command.pre_exec(move || {
            unsafe {
                // CPU time limit (with extra time)
                let total_cpu_time = limits.cpu_time + limits.cpu_extra_time;
                let cpu_limit = libc::rlimit {
                    rlim_cur: total_cpu_time as u64,
                    rlim_max: total_cpu_time as u64,
                };
                libc::setrlimit(libc::RLIMIT_CPU, &cpu_limit);
                
                // Memory limit
                let mem_limit = libc::rlimit {
                    rlim_cur: limits.memory,
                    rlim_max: limits.memory,
                };
                libc::setrlimit(libc::RLIMIT_AS, &mem_limit);
                
                // Stack limit
                let stack_limit = libc::rlimit {
                    rlim_cur: limits.stack_limit,
                    rlim_max: limits.stack_limit,
                };
                libc::setrlimit(libc::RLIMIT_STACK, &stack_limit);
                
                // File size limit
                let file_limit = libc::rlimit {
                    rlim_cur: limits.file_size,
                    rlim_max: limits.file_size,
                };
                libc::setrlimit(libc::RLIMIT_FSIZE, &file_limit);
                
                // Process/thread limit
                let proc_limit = libc::rlimit {
                    rlim_cur: limits.processes as u64,
                    rlim_max: limits.processes as u64,
                };
                libc::setrlimit(libc::RLIMIT_NPROC, &proc_limit);
                
                // Core dump limit (disable core dumps for security)
                let core_limit = libc::rlimit {
                    rlim_cur: 0,
                    rlim_max: 0,
                };
                libc::setrlimit(libc::RLIMIT_CORE, &core_limit);
            }
            
            Ok(())
        });
        
        Ok(())
    }
    
    #[cfg(windows)]
    fn apply_windows_limits(&self, _command: &mut Command) -> Result<()> {
        // Windows doesn't have setrlimit, but we can use:
        // - Job objects for resource limits
        // - Restricted tokens for security
        // - Process isolation
        
        warn!("Windows sandboxing not fully implemented yet");
        Ok(())
    }
}
