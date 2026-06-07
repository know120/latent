use async_openai::{
    types::{
        ChatCompletionRequestAssistantMessageArgs,
        ChatCompletionRequestMessage,
        ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs,
    },
    Client as OpenAIClient,
};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub api_key: String,
    pub selected_model: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub active_provider: String,
    pub providers: std::collections::HashMap<String, ProviderConfig>,
}

impl AppConfig {
    fn default() -> Self {
        let mut providers = std::collections::HashMap::new();
        providers.insert(
            "google".to_string(),
            ProviderConfig {
                api_key: "".to_string(),
                selected_model: "gemini-2.5-flash".to_string(),
            },
        );
        providers.insert(
            "openai".to_string(),
            ProviderConfig {
                api_key: "".to_string(),
                selected_model: "gpt-4o".to_string(),
            },
        );

        Self {
            active_provider: "google".to_string(),
            providers,
        }
    }
}

fn get_config_path<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    app.path()
        .app_config_dir()
        .expect("Failed to get app config dir")
        .join("config.json")
}

#[tauri::command]
async fn get_config<R: Runtime>(app: AppHandle<R>) -> Result<AppConfig, String> {
    let path = get_config_path(&app);
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
async fn save_config<R: Runtime>(app: AppHandle<R>, config: AppConfig) -> Result<bool, String> {
    let path = get_config_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn check_api_key<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    let config = get_config(app).await?;
    let provider = config.active_provider.clone();
    if let Some(p_config) = config.providers.get(&provider) {
        return Ok(!p_config.api_key.is_empty());
    }
    Ok(false)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatMessage {
    pub role: String,
    pub parts: Vec<MessagePart>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessagePart {
    pub text: String,
}

#[tauri::command]
async fn send_to_ai<R: Runtime>(
    app: AppHandle<R>,
    user_message: String,
    chat_history: Vec<ChatMessage>,
) -> Result<String, String> {
    let config = get_config(app).await?;
    let provider = config.active_provider.clone();
    let p_config = config
        .providers
        .get(&provider)
        .ok_or("Provider not found")?;
    let api_key = &p_config.api_key;
    let model_name = &p_config.selected_model;

    if api_key.is_empty() {
        return Err("AI not configured. Please set your API key in settings.".to_string());
    }

    if provider == "google" {
        // Gemini API call via REST
        let client = HttpClient::new();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model_name, api_key
        );

        let mut contents = Vec::new();
        for msg in chat_history {
            contents.push(serde_json::json!({
                "role": if msg.role == "user" { "user" } else { "model" },
                "parts": msg.parts.iter().map(|p| serde_json::json!({ "text": p.text })).collect::<Vec<_>>()
            }));
        }
        contents.push(serde_json::json!({
            "role": "user",
            "parts": [{ "text": user_message }]
        }));

        let body = serde_json::json!({
            "contents": contents
        });

        let resp = client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.map_err(|e| e.to_string())?;
            return Err(format!("Google API error: {}", err_text));
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let text = json["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or("Failed to parse Google AI response")?;

        Ok(text.to_string())
    } else if provider == "openai" {
        // OpenAI API call
        let client = OpenAIClient::new();
        std::env::set_var("OPENAI_API_KEY", api_key);

        let mut messages = Vec::new();
        for msg in chat_history {
            let role = if msg.role == "user" {
                "user"
            } else {
                "assistant"
            };
            let text = msg.parts.get(0).map(|p| p.text.as_str()).unwrap_or("");
             messages.push(match role {
                 "user" => ChatCompletionRequestMessage::User(
                     ChatCompletionRequestUserMessageArgs::default()
                         .content(text.to_string())
                         .build()
                         .unwrap(),
                 ),
                 _ => ChatCompletionRequestMessage::Assistant(
                     ChatCompletionRequestAssistantMessageArgs::default()
                         .content(text.to_string())
                         .build()
                         .unwrap(),
                 ),
             });

        }
         messages.push(
             ChatCompletionRequestMessage::User(
                 ChatCompletionRequestUserMessageArgs::default()
                     .content(user_message.clone())
                     .build()
                     .unwrap(),
             ),
         );


        let request = CreateChatCompletionRequestArgs::default()
            .model(model_name)
            .messages(messages)
            .build()
            .map_err(|e| e.to_string())?;

        let response = client
            .chat()
            .create(request)
            .await
            .map_err(|e| e.to_string())?;
        let content = response.choices[0]
            .message
            .content
            .as_ref()
            .ok_or("Failed to parse OpenAI AI response")?;

        Ok(content.clone())
    } else {
        Err("Unsupported provider".to_string())
    }
}

use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {

            let app_handle = app.handle().clone();
            let _ = app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+H", move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            });
            
            let _ = app.global_shortcut().register("CmdOrCtrl+Shift+H");
            Ok(())
        })

        .invoke_handler(tauri::generate_handler![get_config, save_config, check_api_key, send_to_ai])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

