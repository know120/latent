fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&[
                "get_config",
                "save_config",
                "check_api_key",
                "send_to_ai",
            ])),
    )
    .unwrap()
}
