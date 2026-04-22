//! System sound playback for Tauri (iOS + macOS).
//!
//! iOS:    AudioServicesPlaySystemSound
//! macOS:  NSSound (named system sounds)

// ── iOS ────────────────────────────────────────────────────────────

#[cfg(target_os = "ios")]
mod platform {
    /// AudioServices system sound IDs.
    const SOUND_TAP: u32 = 1104;      // keyboard click
    const SOUND_SUCCESS: u32 = 1394;  // payment success
    const SOUND_WARN: u32 = 1073;     // tock
    const SOUND_SAVE: u32 = 1156;     // key press

    #[link(name = "AudioToolbox", kind = "framework")]
    unsafe extern "C" {
        fn AudioServicesPlaySystemSound(systemSoundID: u32);
    }

    pub fn play_system_sound(name: &str) -> Result<(), String> {
        let sound_id = match name {
            "tap" => SOUND_TAP,
            "success" => SOUND_SUCCESS,
            "warn" => SOUND_WARN,
            "save" => SOUND_SAVE,
            _ => SOUND_TAP,
        };

        unsafe {
            AudioServicesPlaySystemSound(sound_id);
        }
        Ok(())
    }
}

// ── macOS ──────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod platform {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::class;
    use objc::{msg_send, sel, sel_impl};

    type Id = id;

    pub fn play_system_sound(name: &str) -> Result<(), String> {
        let sound_name = match name {
            "tap" => "Tink",
            "success" => "Hero",
            "warn" => "Basso",
            "save" => "Pop",
            _ => "Tink",
        };

        unsafe {
            let ns_name = NSString::alloc(nil).init_str(sound_name);
            let ns_sound: Id = msg_send![class!(NSSound), soundNamed: ns_name];
            if ns_sound == nil {
                return Err(format!("System sound '{}' not found", sound_name));
            }
            let _: () = msg_send![ns_sound, play];
        }
        Ok(())
    }
}

// ── Fallback ───────────────────────────────────────────────────────

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
mod platform {
    pub fn play_system_sound(_name: &str) -> Result<(), String> {
        Ok(())
    }
}

// ── Tauri command ──────────────────────────────────────────────────

#[tauri::command]
pub async fn play_system_sound(name: String) -> Result<(), String> {
    dispatch_to_main(move || platform::play_system_sound(&name))
}

fn dispatch_to_main<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce() -> Result<R, String> + Send + 'static,
    R: Send + 'static,
{
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();
    dispatch::Queue::main().exec_sync(move || {
        let _ = tx.send(f());
    });
    rx.recv()
        .map_err(|e| format!("Main-thread dispatch failed: {}", e))?
}
