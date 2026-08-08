fn main() {
    // `cargo run`/`tauri dev` spawn the exe via CreateProcess, which can't silently elevate an
    // elevated-manifest binary (fails with os error 740 unless the terminal itself is already
    // elevated) — only embed the manifest in release builds, launched via the installer/Explorer
    // (ShellExecute), which does trigger UAC prompts correctly.
    #[cfg(windows)]
    if std::env::var("PROFILE").as_deref() == Ok("release") {
        // Must keep the Common-Controls v6 dependency the default tauri-generated manifest
        // includes — dropping it silently reverts the app to comctl32 v5, which is missing
        // APIs like TaskDialogIndirect that native dialogs (tauri-plugin-dialog) rely on.
        //
        // `asInvoker`, not `requireAdministrator`: elevation is opt-in at runtime (see
        // services::elevation) rather than baked into the manifest, so autostart and the
        // installer's "launch after install" step — both of which launch de-elevated — keep
        // working when the user hasn't opted into running as admin.
        const MANIFEST: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
</assembly>"#;

        let windows = tauri_build::WindowsAttributes::new().app_manifest(MANIFEST);
        tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
            .expect("failed to run tauri-build");
        return;
    }

    tauri_build::build()
}
