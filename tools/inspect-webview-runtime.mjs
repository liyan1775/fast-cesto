const [, , portText = "9222"] = process.argv;
const port = Number(portText);

function cdpRequest(webSocketDebuggerUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    const id = 1;
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("CDP request timed out"));
    }, 3000);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) {
        return;
      }
      clearTimeout(timeout);
      socket.close();
      if (message.error) {
        reject(new Error(JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
    });
    socket.addEventListener("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const expression = `(async () => ({
  location: self.location?.href ?? null,
  documentTitle: typeof document === "undefined" ? null : document.title,
  hasC3: typeof self.C3 !== "undefined",
  c3Keys: typeof self.C3 === "undefined" ? [] : Object.keys(self.C3).slice(0, 80),
  fastCestoRuntime: typeof self.FastCestoRuntime,
  globalRuntime: typeof self.runtime,
  localStorageKeys: typeof localStorage === "undefined" ? [] : Object.keys(localStorage).sort(),
  indexedDatabases: typeof indexedDB?.databases !== "function"
    ? []
    : (await indexedDB.databases()).map(database => ({ name: database.name, version: database.version })),
  bodyText: typeof document === "undefined" ? null : document.body?.innerText?.slice(0, 500) ?? null,
  elements: typeof document === "undefined" ? [] : Array.from(document.body?.children ?? []).map(element => ({
    tag: element.tagName,
    id: element.id,
    className: String(element.className),
    rect: (() => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()
  }))
}))()`;
const reports = [];

for (const target of targets.filter((candidate) => candidate.type === "page")) {
  try {
    const result = await cdpRequest(
      target.webSocketDebuggerUrl,
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
    );
    reports.push({
      id: target.id,
      type: target.type,
      title: target.title,
      url: target.url,
      evaluation: result.result?.value ?? result.result,
      exceptionDetails: result.exceptionDetails ?? null,
    });
  } catch (error) {
    reports.push({
      id: target.id,
      type: target.type,
      title: target.title,
      url: target.url,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

console.log(JSON.stringify(reports, null, 2));
