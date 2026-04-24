import { onCleanup, onMount, type JSX } from "solid-js";

/**
 * Mounts the React-based Agentation feedback toolbar inside a SolidJS app.
 *
 * Dev-only: the guard on `import.meta.env.DEV` ensures the entire body is
 * dead-code eliminated in production builds.
 */
export function AgentationHost(): JSX.Element {
  let container: HTMLDivElement | undefined;
  const setContainer = (el: HTMLDivElement) => {
    container = el;
  };
  let root: ReturnType<typeof import("react-dom/client")["createRoot"]> | undefined;

  onMount(() => {
    if (!container || !import.meta.env.DEV) return;

    Promise.all([
      import("react"),
      import("react-dom/client"),
      import("agentation"),
    ])
      .then(([react, reactDom, agentation]) => {
        if (!container) return;
        root = reactDom.createRoot(container);
        root.render(react.createElement(agentation.Agentation));
      })
      .catch((err) => {
        console.warn("[agentation] failed to load:", err);
      });
  });

  onCleanup(() => {
    root?.unmount();
    root = undefined;
  });

  return <div ref={setContainer} style={{ display: "contents" }} />;
}
