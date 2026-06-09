import { createRoot } from "react-dom/client";
import App from "./App";
import { LanguageProvider } from "./contexts/language-context";
import "./index.css";

// lightweight-charts disposal race ("Object is disposed").
//
// When a chart is removed during an unmount/remount (tab switch, symbol change,
// navigation, HMR), its canvas binding is torn down (`_canvasElement = null`).
// But the chart schedules its draw/layout asynchronously, so an already-queued
// callback can still fire AFTER disposal, hit the `canvasElement` getter, and
// throw "Object is disposed" from INSIDE the library. The throw escapes any
// local try/catch and can't be reliably suppressed via a window 'error' listener
// (Replit's error instrumentation registers its capture-phase handler first).
//
// The reliable fix is to stop the throw at its async source. The library
// schedules draws via `window.requestAnimationFrame(...)` (and observes size via
// `ResizeObserver`), both resolved at call time — so we wrap those globals to
// swallow ONLY this benign disposal error. Any other error is rethrown so real
// bugs still surface.
// Only swallow the benign disposal throw — and only when the stack confirms it
// came from lightweight-charts' internal binding, so unrelated bugs still surface.
function isDisposalError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message !== "Object is disposed") return false;
  const stack = err.stack ?? "";
  return (
    stack.includes("lightweight-charts") ||
    stack.includes("DevicePixelContentBoxBinding") ||
    stack.includes("TimeAxisWidget")
  );
}

const nativeRAF = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = function (callback: FrameRequestCallback): number {
  return nativeRAF((time) => {
    try {
      callback(time);
    } catch (err) {
      if (!isDisposalError(err)) throw err;
      // benign lightweight-charts disposal race — swallow it
    }
  });
};

const NativeResizeObserver = window.ResizeObserver;
if (NativeResizeObserver) {
  window.ResizeObserver = class extends NativeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        try {
          callback(entries, observer);
        } catch (err) {
          if (!isDisposalError(err)) throw err;
          // benign lightweight-charts disposal race — swallow it
        }
      });
    }
  };
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
