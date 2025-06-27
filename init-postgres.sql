-- LabForCode - PostgreSQL Database Initialization
-- Compatible with PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Submissions table with full Judge0 compatibility
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) UNIQUE NOT NULL,
    
    -- Source and input
    language VARCHAR(50) NOT NULL,
    language_id INTEGER,
    source_code TEXT NOT NULL,
    stdin TEXT DEFAULT '',
    expected_output TEXT,
    compiler_options TEXT,
    command_line_arguments TEXT,
    callback_url TEXT,
    additional_files TEXT, -- Base64 encoded ZIP
    
    -- Resource limits
    cpu_time_limit FLOAT DEFAULT 2.0,
    cpu_extra_time FLOAT DEFAULT 0.5,
    wall_time_limit FLOAT DEFAULT 5.0,
    memory_limit INTEGER DEFAULT 128000,
    stack_limit INTEGER DEFAULT 64000,
    max_processes_and_or_threads INTEGER DEFAULT 60,
    enable_per_process_and_thread_time_limit BOOLEAN DEFAULT FALSE,
    enable_per_process_and_thread_memory_limit BOOLEAN DEFAULT TRUE,
    max_file_size INTEGER DEFAULT 1024,
    redirect_stderr_to_stdout BOOLEAN DEFAULT FALSE,
    enable_network BOOLEAN DEFAULT FALSE,
    number_of_runs INTEGER DEFAULT 1,
    
    -- Status and results
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    stdout TEXT,
    stderr TEXT,
    compile_output TEXT,
    message TEXT,
    exit_code INTEGER,
    exit_signal INTEGER,
    time FLOAT, -- execution time in seconds
    wall_time FLOAT,
    memory FLOAT, -- memory usage in KB
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    
    -- Legacy/sharing
    shared BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(255),
    
    -- Batch processing
    batch_id UUID,
    batch_index INTEGER,
    
    -- Webhook
    webhook_sent BOOLEAN DEFAULT FALSE,
    webhook_attempts INTEGER DEFAULT 0
);

-- Languages table for Judge0 compatibility
CREATE TABLE IF NOT EXISTS languages (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    compile_cmd TEXT,
    run_cmd TEXT NOT NULL,
    source_file VARCHAR(100) NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE
);

-- Insert supported languages
INSERT INTO languages (id, name, compile_cmd, run_cmd, source_file, is_archived) VALUES
(50, 'C (GCC 9.2.0)', 'gcc -o main main.c', './main', 'main.c', FALSE),
(54, 'C++ (GCC 9.2.0)', 'g++ -o main main.cpp', './main', 'main.cpp', FALSE),
(60, 'Go (1.13.5)', NULL, 'go run main.go', 'main.go', FALSE),
(63, 'JavaScript (Node.js 12.14.0)', NULL, 'node main.js', 'main.js', FALSE),
(71, 'Python (3.8.1)', NULL, 'python3 main.py', 'main.py', FALSE),
(73, 'Rust (1.40.0)', 'rustc main.rs', './main', 'main.rs', FALSE),
(91, 'Java (OpenJDK 13.0.1)', 'javac Main.java', 'java Main', 'Main.java', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Statuses table for Judge0 compatibility  
CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY,
    description VARCHAR(100) NOT NULL
);

-- Insert Judge0 compatible statuses
INSERT INTO statuses (id, description) VALUES
(1, 'In Queue'),
(2, 'Processing'),
(3, 'Accepted'),
(4, 'Wrong Answer'),
(5, 'Time Limit Exceeded'),
(6, 'Compilation Error'),
(7, 'Runtime Error (SIGSEGV)'),
(8, 'Runtime Error (SIGXFSZ)'),
(9, 'Runtime Error (SIGFPE)'),
(10, 'Runtime Error (SIGABRT)'),
(11, 'Runtime Error (NZEC)'),
(12, 'Runtime Error (Other)'),
(13, 'Internal Error'),
(14, 'Exec Format Error')
ON CONFLICT (id) DO NOTHING;

-- Configuration table for system settings
CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO config (key, value, description) VALUES
('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
('max_cpu_time', '5.0', 'Maximum CPU time limit in seconds'),
('max_memory', '256000', 'Maximum memory limit in KB'),
('max_wall_time', '10.0', 'Maximum wall time limit in seconds'),
('enable_batches', 'true', 'Enable batch submissions'),
('enable_callbacks', 'true', 'Enable callback URLs'),
('max_batch_size', '20', 'Maximum submissions per batch')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_language_id ON submissions(language_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON submissions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_finished_at ON submissions(finished_at);

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'LabForCode database initialized successfully!';
    RAISE NOTICE 'Tables created: submissions, languages, statuses, config';
    RAISE NOTICE 'Ready for local compiler execution with Judge0 compatibility';
END $$;
