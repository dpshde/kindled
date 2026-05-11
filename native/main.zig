const std = @import("std");
const runner = @import("runner");
const zero_native = @import("zero-native");

pub const panic = std.debug.FullPanic(zero_native.debug.capturePanic);

// ---------------------------------------------------------------------------
// Bridge command names — must match app.zon .bridge.commands
// ---------------------------------------------------------------------------

const cmd_share_url = "share.url";
const cmd_share_text = "share.text";
const cmd_shell_open = "shell.open";
const cmd_fs_write = "fs.writeTextFile";
const cmd_os_platform = "os.platform";
const cmd_haptics_impact = "haptics.impact";
const cmd_haptics_notification = "haptics.notification";
const cmd_haptics_macos = "haptics.macos";

// ---------------------------------------------------------------------------
// Bridge policies
// ---------------------------------------------------------------------------

const app_origins = [_][]const u8{ "zero://app", "zero://inline" };

const bridge_policies = [_]zero_native.BridgeCommandPolicy{
    .{ .name = cmd_share_url },
    .{ .name = cmd_share_text },
    .{ .name = cmd_shell_open },
    .{ .name = cmd_fs_write },
    .{ .name = cmd_os_platform },
    .{ .name = cmd_haptics_impact },
    .{ .name = cmd_haptics_notification },
    .{ .name = cmd_haptics_macos },
};

const window_permission = [_][]const u8{zero_native.security.permission_window};
const builtin_policies = [_]zero_native.BridgeCommandPolicy{
    .{ .name = "zero-native.window.list", .permissions = &window_permission, .origins = &app_origins },
    .{ .name = "zero-native.window.create", .permissions = &window_permission, .origins = &app_origins },
    .{ .name = "zero-native.window.focus", .permissions = &window_permission, .origins = &app_origins },
    .{ .name = "zero-native.window.close", .permissions = &window_permission, .origins = &app_origins },
};

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

const app_permissions = [_][]const u8{zero_native.security.permission_window};
const allowed_origins = [_][]const u8{ "zero://app", "zero://inline", "http://127.0.0.1:3001" };

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const KindledApp = struct {
    bridge_handlers: [8]zero_native.BridgeHandler = undefined,
    env_map: *std.process.Environ.Map,

    fn app(self: *@This()) zero_native.App {
        return .{
            .context = self,
            .name = "kindled",
            .source = zero_native.frontend.productionSource(.{ .dist = "dist" }),
            .source_fn = source,
        };
    }

    fn source(context: *anyopaque) anyerror!zero_native.WebViewSource {
        const self: *@This() = @ptrCast(@alignCast(context));
        if (self.env_map.get("ZERO_NATIVE_FRONTEND_URL") != null) {
            return zero_native.frontend.sourceFromEnv(self.env_map, .{ .dist = "dist" });
        }
        if (self.env_map.get("ZERO_NATIVE_FRONTEND_ASSETS") != null) {
            return zero_native.frontend.productionSource(.{ .dist = "dist" });
        }
        return zero_native.frontend.productionSource(.{ .dist = "dist" });
    }

    fn bridge(self: *@This()) zero_native.BridgeDispatcher {
        self.bridge_handlers = .{
            .{ .name = cmd_share_url, .context = self, .invoke_fn = handleShareUrl },
            .{ .name = cmd_share_text, .context = self, .invoke_fn = handleShareText },
            .{ .name = cmd_shell_open, .context = self, .invoke_fn = handleShellOpen },
            .{ .name = cmd_fs_write, .context = self, .invoke_fn = handleFsWrite },
            .{ .name = cmd_os_platform, .context = self, .invoke_fn = handleOsPlatform },
            .{ .name = cmd_haptics_impact, .context = self, .invoke_fn = handleHapticsImpact },
            .{ .name = cmd_haptics_notification, .context = self, .invoke_fn = handleHapticsNotification },
            .{ .name = cmd_haptics_macos, .context = self, .invoke_fn = handleHapticsMacos },
        };
        return .{
            .policy = .{ .enabled = true, .commands = &bridge_policies },
            .registry = .{ .handlers = &self.bridge_handlers },
        };
    }

    // -- share.url ----------------------------------------------------------
    fn handleShareUrl(_: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        // TODO: macOS — NSSharingServicePicker via ObjC runtime
        return std.fmt.bufPrint(output, "{{\"ok\":true,\"note\":\"share.url stub\"}}", .{});
    }

    // -- share.text ---------------------------------------------------------
    fn handleShareText(_: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        // TODO: macOS — NSSharingServicePicker via ObjC runtime
        return std.fmt.bufPrint(output, "{{\"ok\":true,\"note\":\"share.text stub\"}}", .{});
    }

    // -- shell.open ---------------------------------------------------------
    fn handleShellOpen(_: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        // TODO: macOS — [[NSWorkspace sharedWorkspace] openURL:]
        return std.fmt.bufPrint(output, "{{\"ok\":true,\"note\":\"shell.open stub\"}}", .{});
    }

    // -- fs.writeTextFile ----------------------------------------------------
    fn handleFsWrite(_: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        // TODO: Extract path + content from invocation payload, write to disk
        return std.fmt.bufPrint(output, "{{\"ok\":true,\"note\":\"fs.writeTextFile stub\"}}", .{});
    }

    // -- os.platform --------------------------------------------------------
    fn handleOsPlatform(_: *anyopaque, _: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        const build_options = @import("build_options");
        return std.fmt.bufPrint(output, "\"{s}\"", .{build_options.platform});
    }

    // -- haptics.impact -----------------------------------------------------
    fn handleHapticsImpact(_: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        // TODO: iOS — UIImpactFeedbackGenerator
        return std.fmt.bufPrint(output, "{{\"ok\":true}}", .{});
    }

    // -- haptics.notification -----------------------------------------------
    fn handleHapticsNotification(_: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        // TODO: iOS — UINotificationFeedbackGenerator
        return std.fmt.bufPrint(output, "{{\"ok\":true}}", .{});
    }

    // -- haptics.macos ------------------------------------------------------
    fn handleHapticsMacos(_: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        // TODO: macOS — NSHapticFeedbackManager
        return std.fmt.bufPrint(output, "{{\"ok\":true}}", .{});
    }
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

pub fn main(init: std.process.Init) !void {
    var kindled = KindledApp{ .env_map = init.environ_map };
    try runner.runWithOptions(kindled.app(), .{
        .app_name = "Kindled",
        .window_title = "Kindled",
        .bundle_id = "dev.kindled.app",
        .icon_path = "assets/icon.icns",
        .bridge = kindled.bridge(),
        .builtin_bridge = .{ .enabled = true, .commands = &builtin_policies },
        .security = .{
            .permissions = &app_permissions,
            .navigation = .{ .allowed_origins = &allowed_origins },
        },
    }, init);
}
