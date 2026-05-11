interface ZeroNativeDialogFilter {
  name: string;
  extensions: string[];
}

interface ZeroNativeOpenFileOptions {
  allowMultiple?: boolean;
  filters?: ZeroNativeDialogFilter[];
  defaultPath?: string;
}

interface ZeroNativeSaveFileOptions {
  defaultPath?: string;
  filters?: ZeroNativeDialogFilter[];
}

interface ZeroNativeMessageOptions {
  title?: string;
  message?: string;
  style?: "info" | "warning" | "error";
  buttons?: string[];
}

interface ZeroNativeWindowCreateOptions {
  label?: string;
  title?: string;
  width?: number;
  height?: number;
  url?: string;
}

interface ZeroNativeWindowInfo {
  id: number;
  label: string;
  title: string;
  width: number;
  height: number;
  focused: boolean;
}

interface ZeroNativeWindows {
  list(): Promise<ZeroNativeWindowInfo[]>;
  create(options: ZeroNativeWindowCreateOptions): Promise<ZeroNativeWindowInfo>;
  focus(labelOrId: string | number): Promise<void>;
  close(labelOrId: string | number): Promise<void>;
  minimize(labelOrId?: string | number): Promise<void>;
  maximize(labelOrId?: string | number): Promise<void>;
  isMaximized(labelOrId?: string | number): Promise<boolean>;
  unmaximize(labelOrId?: string | number): Promise<void>;
}

interface ZeroNativeDialogs {
  openFile(options?: ZeroNativeOpenFileOptions): Promise<string[] | null>;
  saveFile(options?: ZeroNativeSaveFileOptions): Promise<string | null>;
  showMessage(options: ZeroNativeMessageOptions): Promise<string>;
}

interface ZeroNative {
  invoke<T = unknown>(command: string, payload?: Record<string, unknown>): Promise<T>;
  on(event: string, callback: (detail: unknown) => void): () => void;
  windows: ZeroNativeWindows;
  dialogs: ZeroNativeDialogs;
}

declare global {
  interface Window {
    zero?: ZeroNative;
  }
}

export {};
