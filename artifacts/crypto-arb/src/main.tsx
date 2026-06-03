import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// lightweight-charts uses an internal ResizeObserver (DevicePixelContentBoxBinding)
// that can fire one last queued callback after a chart is disposed during an
// unmount/remount (tab switch, symbol change, navigation). That callback throws a
// benign "Object is disposed" error from inside the library, which we can't wrap in
// a try/catch. Swallow only this specific error so it doesn't surface as an
// app-crashing runtime-error overlay; everything else propagates normally.
function isDisposedChartError(message: unknown, stack?: string): boolean {
  const msg = typeof message === "string" ? message : "";
  return (
    msg.includes("Object is disposed") &&
    (stack ?? "").includes("lightweight-charts")
  );
}

window.addEventListener(
  "error",
  (event) => {
    if (isDisposedChartError(event.message, event.error?.stack)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  if (isDisposedChartError(reason?.message ?? reason, reason?.stack)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
