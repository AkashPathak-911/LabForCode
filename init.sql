-- Initialize database for LabForCode
-- Note: UUID generation will use NEWID() instead of uuid-ossp extension

-- Submissions table with full Judge0 compatibility
CREATE TABLE submissions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    token VARCHAR(255) UNIQUE NOT NULL,
    
    -- Source and input
    language VARCHAR(50) NOT NULL,
    language_id INTEGER,
    source_code NVARCHAR(MAX) NOT NULL,
    stdin NVARCHAR(MAX) DEFAULT '',
    expected_output NVARCHAR(MAX),
    compiler_options NVARCHAR(MAX),
    command_line_arguments NVARCHAR(MAX),
    callback_url NVARCHAR(MAX),
    additional_files NVARCHAR(MAX), -- Base64 encoded ZIP
    
    -- Resource limits
    cpu_time_limit FLOAT DEFAULT 2.0,
    cpu_extra_time FLOAT DEFAULT 0.5,
    wall_time_limit FLOAT DEFAULT 5.0,
    memory_limit INTEGER DEFAULT 128000,
    stack_limit INTEGER DEFAULT 64000,
    max_processes_and_or_threads INTEGER DEFAULT 60,
    enable_per_process_and_thread_time_limit BIT DEFAULT 0,
    enable_per_process_and_thread_memory_limit BIT DEFAULT 1,
    max_file_size INTEGER DEFAULT 1024,
    redirect_stderr_to_stdout BIT DEFAULT 0,
    enable_network BIT DEFAULT 1,
    number_of_runs INTEGER DEFAULT 1,
    
    -- Status and results
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    stdout NVARCHAR(MAX),
    stderr NVARCHAR(MAX),
    compile_output NVARCHAR(MAX),
    message NVARCHAR(MAX),
    exit_code INTEGER,
    exit_signal INTEGER,
    time FLOAT, -- execution time in seconds
    wall_time FLOAT,
    memory FLOAT, -- memory usage in KB
    
    -- Timestamps
    created_at DATETIMEOFFSET DEFAULT GETDATE(),
    finished_at DATETIMEOFFSET,
    
    -- Legacy/sharing
    share_id VARCHAR(100) UNIQUE,
    user_id UNIQUEIDENTIFIER, -- for future user management
    
    CONSTRAINT status_check CHECK (status IN (
        'queued', 'running', 'completed', 'error', 'timeout', 
        'accepted', 'wrong_answer', 'compilation_error', 'runtime_error', 
        'time_limit_exceeded', 'memory_limit_exceeded'
    ))
);

-- Index for performance
CREATE INDEX idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_share_id ON submissions(share_id);
CREATE INDEX idx_submissions_token ON submissions(token);

-- Judge0 compatible languages table
CREATE TABLE judge0_languages (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_archived BIT DEFAULT 0,
    source_file VARCHAR(50),
    compile_cmd NVARCHAR(MAX),
    run_cmd NVARCHAR(MAX)
);

-- Insert Judge0 compatible languages
INSERT INTO judge0_languages (id, name, is_archived, source_file, compile_cmd, run_cmd) VALUES
(45, 'Assembly (NASM 2.14.02)', 0, 'main.asm', 'nasm -f elf64 main.asm && ld main.o -o main', './main'),
(46, 'Bash (5.0.0)', 0, 'script.sh', NULL, 'bash script.sh'),
(48, 'C (GCC 7.4.0)', 0, 'main.c', 'gcc main.c -o main', './main'),
(52, 'C++ (GCC 7.4.0)', 0, 'main.cpp', 'g++ main.cpp -o main', './main'),
(51, 'C# (Mono 6.6.0.161)', 0, 'Main.cs', 'mcs Main.cs', 'mono Main.exe'),
(62, 'Java (OpenJDK 13.0.1)', 0, 'Main.java', 'javac Main.java', 'java Main'),
(63, 'JavaScript (Node.js 12.14.0)', 0, 'script.js', NULL, 'node script.js'),
(70, 'Python (2.7.17)', 0, 'script.py', NULL, 'python2 script.py'),
(71, 'Python (3.8.1)', 0, 'script.py', NULL, 'python3 script.py'),
(72, 'Ruby (2.7.0)', 0, 'script.rb', NULL, 'ruby script.rb'),
(73, 'Rust (1.40.0)', 0, 'main.rs', 'rustc main.rs', './main'),
(74, 'TypeScript (3.7.4)', 0, 'script.ts', 'tsc script.ts', 'node script.js'),
(60, 'Go (1.13.5)', 0, 'main.go', NULL, 'go run main.go');

-- Judge0 compatible statuses table
CREATE TABLE judge0_statuses (
    id INTEGER PRIMARY KEY,
    description VARCHAR(100) NOT NULL
);

INSERT INTO judge0_statuses (id, description) VALUES
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
(14, 'Exec Format Error');

-- Languages table for configuration
CREATE TABLE languages (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    extension VARCHAR(10) NOT NULL,
    compile_command NVARCHAR(MAX),
    run_command NVARCHAR(MAX) NOT NULL,
    timeout_ms INTEGER NOT NULL DEFAULT 10000,
    memory_limit_bytes INTEGER NOT NULL DEFAULT 134217728, -- 128MB
    enabled BIT DEFAULT 1,
    created_at DATETIMEOFFSET DEFAULT GETDATE()
);

-- Insert default languages
INSERT INTO languages (id, name, extension, compile_command, run_command, timeout_ms, memory_limit_bytes) VALUES
('python', 'Python 3.11', 'py', NULL, 'python3 {file}', 10000, 134217728),
('javascript', 'Node.js 18', 'js', NULL, 'node {file}', 10000, 134217728),
('java', 'Java 17', 'java', 'javac {file}', 'java {classname}', 15000, 268435456),
('cpp', 'C++ 17', 'cpp', 'g++ -o {output} {file} -std=c++17', './{output}', 15000, 134217728),
('c', 'C 17', 'c', 'gcc -o {output} {file} -std=c17 -lm', './{output}', 15000, 134217728),
('go', 'Go 1.21', 'go', NULL, 'go run {file}', 10000, 134217728),
('rust', 'Rust 1.70', 'rs', 'rustc {file} -o {output}', './{output}', 20000, 268435456);

-- Users table (for future expansion)
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIMEOFFSET DEFAULT GETDATE(),
    last_login DATETIMEOFFSET
);

-- API Keys table (for future API access)
CREATE TABLE api_keys (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    rate_limit INTEGER DEFAULT 100, -- requests per hour
    created_at DATETIMEOFFSET DEFAULT GETDATE(),
    expires_at DATETIMEOFFSET,
    last_used DATETIMEOFFSET
);
