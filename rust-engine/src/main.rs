use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete},
    Router,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing::{info, warn};

mod engine;
mod executor;
mod queue;
mod sandbox;
mod types;

use engine::ExecutionEngine;
use types::*;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    engine: Arc<ExecutionEngine>,
}

/// Main entry point for the Rust execution engine
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    // Load environment variables
    dotenv::dotenv().ok();
    
    info!("🦀 Starting LabForCode Rust Engine");
    
    // Initialize the execution engine
    let engine = Arc::new(ExecutionEngine::new().await?);
    let state = AppState { engine };
    
    // Build the router
    let app = Router::new()
        .route("/", get(health_check))
        .route("/health", get(health_check))
        .route("/execute", post(execute_code))
        .route("/status/:id", get(get_execution_status))
        .route("/result/:id", get(get_execution_result))
        .route("/cancel/:id", delete(cancel_execution))
        .route("/stats", get(get_engine_stats))
        .route("/languages", get(get_supported_languages))
        .layer(CorsLayer::permissive())
        .with_state(state);
    
    // Start the server
    let port = std::env::var("RUST_ENGINE_PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    info!("🚀 Rust Engine listening on {}", addr);
    
    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

/// Health check endpoint
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        engine: "rust".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Utc::now(),
    })
}

/// Execute code submission
async fn execute_code(
    State(state): State<AppState>,
    Json(request): Json<ExecutionRequest>,
) -> Result<Json<ExecutionResponse>, StatusCode> {
    info!("Received execution request for language: {}", request.language);
    
    match state.engine.submit_execution(request).await {
        Ok(response) => Ok(Json(response)),
        Err(err) => {
            warn!("Execution submission failed: {}", err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get execution status
async fn get_execution_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ExecutionStatus>, StatusCode> {
    match state.engine.get_status(&id).await {
        Ok(Some(status)) => Ok(Json(status)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get execution result
async fn get_execution_result(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ExecutionResult>, StatusCode> {
    let include_output = params.get("include_output")
        .map(|v| v == "true")
        .unwrap_or(true);
    
    match state.engine.get_result(&id, include_output).await {
        Ok(Some(result)) => Ok(Json(result)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Cancel execution
async fn cancel_execution(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<CancelResponse>, StatusCode> {
    match state.engine.cancel_execution(&id).await {
        Ok(success) => Ok(Json(CancelResponse { 
            cancelled: success,
            message: if success { "Execution cancelled" } else { "Could not cancel" }.to_string(),
        })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get engine statistics
async fn get_engine_stats(
    State(state): State<AppState>,
) -> Result<Json<EngineStats>, StatusCode> {
    match state.engine.get_stats().await {
        Ok(stats) => Ok(Json(stats)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get supported languages
async fn get_supported_languages() -> Json<Vec<LanguageInfo>> {
    Json(vec![
        LanguageInfo {
            id: 71,
            name: "Python".to_string(),
            version: "3.11".to_string(),
            compile_cmd: None,
            run_cmd: "python3 main.py".to_string(),
        },
        LanguageInfo {
            id: 63,
            name: "JavaScript".to_string(),
            version: "18.x".to_string(),
            compile_cmd: None,
            run_cmd: "node main.js".to_string(),
        },
        LanguageInfo {
            id: 54,
            name: "C++".to_string(),
            version: "GCC 11".to_string(),
            compile_cmd: Some("g++ -o main main.cpp".to_string()),
            run_cmd: "./main".to_string(),
        },
        LanguageInfo {
            id: 50,
            name: "C".to_string(),
            version: "GCC 11".to_string(),
            compile_cmd: Some("gcc -o main main.c".to_string()),
            run_cmd: "./main".to_string(),
        },
        LanguageInfo {
            id: 73,
            name: "Rust".to_string(),
            version: "1.70".to_string(),
            compile_cmd: Some("rustc main.rs -o main".to_string()),
            run_cmd: "./main".to_string(),
        },
    ])
}
