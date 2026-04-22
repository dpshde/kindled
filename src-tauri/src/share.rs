//! Native share sheet implementation.
//!
//! macOS: NSSharingServicePicker
//! iOS:   UIActivityViewController

// ── macOS ──────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod platform {
    use cocoa::base::{id, nil};
    use cocoa::foundation::{NSArray, NSPoint, NSRect, NSSize, NSString};
    use objc::class;
    use objc::runtime::Class;
    use objc::{msg_send, sel, sel_impl};

    pub fn share_url(url_string: &str) -> Result<(), String> {
        unsafe {
            let url_nsstring = NSString::alloc(nil).init_str(url_string);
            let url: id = msg_send![class!(NSURL), URLWithString: url_nsstring];
            if url == nil {
                return Err("Failed to create URL".to_string());
            }
            let items = NSArray::arrayWithObject(nil, url);
            show_picker(items)
        }
    }

    pub fn share_text(text: &str) -> Result<(), String> {
        unsafe {
            let nsstring = NSString::alloc(nil).init_str(text);
            let items = NSArray::arrayWithObject(nil, nsstring);
            show_picker(items)
        }
    }

    fn show_picker(items: id) -> Result<(), String> {
        unsafe {
            let picker_class = Class::get("NSSharingServicePicker")
                .ok_or("NSSharingServicePicker class not found")?;
            let picker: id = msg_send![picker_class, alloc];
            let picker: id = msg_send![picker, initWithItems: items];
            if picker == nil {
                return Err("Failed to create share picker".to_string());
            }

            let app: id = msg_send![class!(NSApplication), sharedApplication];
            let window: id = msg_send![app, keyWindow];
            if window == nil {
                return Err("No key window available".to_string());
            }
            let content_view: id = msg_send![window, contentView];
            if content_view == nil {
                return Err("No content view available".to_string());
            }
            let frame: NSRect = msg_send![content_view, frame];
            let rect = NSRect::new(
                NSPoint::new(frame.size.width - 100.0, frame.size.height - 50.0),
                NSSize::new(1.0, 1.0),
            );
            let _: () = msg_send![picker, showRelativeToRect:rect ofView:content_view preferredEdge:1_i64];
            Ok(())
        }
    }
}

// ── iOS ────────────────────────────────────────────────────────────

#[cfg(target_os = "ios")]
mod platform {
    use objc::class;
    use objc::runtime::{Class, Object, BOOL, YES};
    use objc::{msg_send, sel, sel_impl};

    type Id = *mut Object;

    pub fn share_url(url_string: &str) -> Result<(), String> {
        let items = unsafe {
            let cstr = std::ffi::CString::new(url_string)
                .map_err(|_| "Invalid URL string")?;
            let nsstring_class = Class::get("NSString").ok_or("NSString class not found")?;
            let ns: Id = msg_send![nsstring_class, alloc];
            let ns: Id = msg_send![ns, initWithUTF8String: cstr.as_ptr()];
            let nsurl_class = Class::get("NSURL").ok_or("NSURL class not found")?;
            let url: Id = msg_send![nsurl_class, URLWithString: ns];
            if url.is_null() {
                return Err("Failed to create URL".to_string());
            }
            let nsarray_class = Class::get("NSArray").ok_or("NSArray class not found")?;
            msg_send![nsarray_class, arrayWithObject: url]
        };
        present_activity_vc(items)
    }

    pub fn share_text(text: &str) -> Result<(), String> {
        let items = unsafe {
            let cstr = std::ffi::CString::new(text)
                .map_err(|_| "Invalid text string")?;
            let nsstring_class = Class::get("NSString").ok_or("NSString class not found")?;
            let ns: Id = msg_send![nsstring_class, alloc];
            let ns: Id = msg_send![ns, initWithUTF8String: cstr.as_ptr()];
            let nsarray_class = Class::get("NSArray").ok_or("NSArray class not found")?;
            msg_send![nsarray_class, arrayWithObject: ns]
        };
        present_activity_vc(items)
    }

    fn present_activity_vc(items: Id) -> Result<(), String> {
        unsafe {
            let vc_class = Class::get("UIActivityViewController")
                .ok_or("UIActivityViewController class not found")?;
            let vc: Id = msg_send![vc_class, alloc];
            let vc: Id = msg_send![vc, initWithActivityItems:items applicationActivities:std::ptr::null::<Object>()];
            if vc.is_null() {
                return Err("Failed to create UIActivityViewController".to_string());
            }

            let root_vc = find_root_vc()?;
            let _: () = msg_send![root_vc, presentViewController:vc animated:YES completion:std::ptr::null::<Object>()];
            Ok(())
        }
    }

    fn find_root_vc() -> Result<Id, String> {
        unsafe {
            let app_class = Class::get("UIApplication").ok_or("UIApplication class not found")?;
            let shared: Id = msg_send![app_class, sharedApplication];
            let scenes: Id = msg_send![shared, connectedScenes];
            let en: Id = msg_send![scenes, objectEnumerator];
            let ws_class = Class::get("UIWindowScene").ok_or("UIWindowScene class not found")?;

            loop {
                let scene: Id = msg_send![en, nextObject];
                if scene.is_null() { break; }
                let is_ws: BOOL = msg_send![scene, isKindOfClass: ws_class];
                if is_ws == YES {
                    let windows: Id = msg_send![scene, windows];
                    let count: usize = msg_send![windows, count];
                    for i in 0..count {
                        let win: Id = msg_send![windows, objectAtIndex: i];
                        let is_key: BOOL = msg_send![win, isKeyWindow];
                        if is_key == YES {
                            let vc: Id = msg_send![win, rootViewController];
                            if !vc.is_null() { return Ok(vc); }
                        }
                    }
                }
            }
            Err("No root view controller found".to_string())
        }
    }
}

// ── Fallback (non-Apple) ───────────────────────────────────────────

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
mod platform {
    pub fn share_url(_url: &str) -> Result<(), String> {
        Err("Native share not available on this platform".to_string())
    }
    pub fn share_text(_text: &str) -> Result<(), String> {
        Err("Native share not available on this platform".to_string())
    }
}

// ── Tauri commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn share_url(url: String) -> Result<(), String> {
    dispatch_to_main(move || platform::share_url(&url))
}

#[tauri::command]
pub async fn share_text(text: String) -> Result<(), String> {
    dispatch_to_main(move || platform::share_text(&text))
}

/// UI operations must run on the main thread; Tauri commands run on
/// tokio worker threads, so we dispatch synchronously.
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
    rx.recv().map_err(|e| format!("Main-thread dispatch failed: {}", e))?
}
