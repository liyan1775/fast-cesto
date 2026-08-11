import { writeFileSync } from "node:fs";

const [, , command, ...args] = process.argv;
const port = 9222;

function cdpClient(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      waiter.reject(new Error(JSON.stringify(message.error)));
    } else {
      waiter.resolve(message.result);
    }
  });

  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    }),
    request(method, params = {}) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

if (!command) {
  console.error(`Usage:
  node webview-input.mjs click <x> <y>
  node webview-input.mjs click-series <x> <y> <output-prefix> [delay-ms]...
  node webview-input.mjs key <key> <code> <windows-virtual-key-code>
  node webview-input.mjs key-down <key> <code> <windows-virtual-key-code>
  node webview-input.mjs key-up <key> <code> <windows-virtual-key-code>
  node webview-input.mjs blur
  node webview-input.mjs screenshot <output.png>`);
  process.exit(2);
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((target) => target.type === "page");
if (!page) {
  throw new Error("No WebView page target found");
}
const client = cdpClient(page.webSocketDebuggerUrl);
await client.ready;

try {
  if (command === "click" || command === "click-series") {
    const [xText, yText] = args;
    const x = Number(xText);
    const y = Number(yText);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("click requires numeric x and y coordinates");
    }
    const capture = async (path) => {
      const result = await client.request("Page.captureScreenshot", { format: "png" });
      writeFileSync(path, Buffer.from(result.data, "base64"), { flag: "wx" });
    };
    if (command === "click-series") {
      const outputPrefix = args[2];
      if (!outputPrefix) {
        throw new Error("click-series requires an output prefix");
      }
    }
    await client.request("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
      button: "none",
      buttons: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    if (command === "click-series") {
      await capture(`${args[2]}-before.png`);
    }
    await client.request("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await client.request("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    if (command === "click-series") {
      const outputPrefix = args[2];
      const delays = args.slice(3).length > 0
        ? args.slice(3).map(Number)
        : [50, 150, 300, 600, 1000];
      let elapsed = 0;
      for (const delay of delays) {
        if (!Number.isFinite(delay) || delay < elapsed) {
          throw new Error("click-series delays must be finite cumulative millisecond values");
        }
        await new Promise((resolve) => setTimeout(resolve, delay - elapsed));
        elapsed = delay;
        await capture(`${outputPrefix}-${delay}ms.png`);
      }
      console.log(JSON.stringify({ command, x, y, delays, outputPrefix }));
    } else {
      console.log(JSON.stringify({ command, x, y }));
    }
  } else if (["key", "key-down", "key-up"].includes(command)) {
    const [key, code, virtualKeyText] = args;
    const windowsVirtualKeyCode = Number(virtualKeyText);
    if (!key || !code || !Number.isInteger(windowsVirtualKeyCode)) {
      throw new Error("key requires key, code, and Windows virtual-key code");
    }
    const params = { key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode };
    if (command !== "key-up") {
      await client.request("Input.dispatchKeyEvent", { type: "keyDown", ...params });
    }
    if (command !== "key-down") {
      await client.request("Input.dispatchKeyEvent", { type: "keyUp", ...params });
    }
    console.log(JSON.stringify({ command, key, code, windowsVirtualKeyCode }));
  } else if (command === "blur") {
    const result = await client.request("Runtime.evaluate", {
      expression: "window.dispatchEvent(new Event('blur'))",
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error("Failed to dispatch the test blur event");
    }
    console.log(JSON.stringify({ command }));
  } else if (command === "screenshot") {
    const [outputPath] = args;
    if (!outputPath) {
      throw new Error("screenshot requires an output path");
    }
    const result = await client.request("Page.captureScreenshot", { format: "png" });
    writeFileSync(outputPath, Buffer.from(result.data, "base64"), { flag: "wx" });
    console.log(JSON.stringify({ command, outputPath }));
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} finally {
  client.close();
}
