const [, , portText = "9222"] = process.argv;
const port = Number(portText);

function cdpRequest(webSocketDebuggerUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    const id = 1;
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("CDP request timed out"));
    }, 5000);
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
const page = targets.find((target) => target.type === "page");
if (!page) {
  throw new Error("No WebView page target found");
}

const expression = `(async () => {
  const databases = await indexedDB.databases();
  const output = [];
  const requestResult = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  for (const descriptor of databases) {
    if (!descriptor.name?.startsWith("c3-localstorage-")) {
      continue;
    }
    const database = await requestResult(indexedDB.open(descriptor.name));
    try {
      for (const storeName of database.objectStoreNames) {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const keys = await requestResult(store.getAllKeys());
        const values = await requestResult(store.getAll());
        output.push({
          database: descriptor.name,
          store: storeName,
          records: keys.map((key, index) => {
            const value = values[index];
            const primitive = value === null || ["string", "number", "boolean"].includes(typeof value);
            const serialized = primitive ? String(value) : JSON.stringify(value);
            return {
              key: String(key),
              valueType: value === null ? "null" : typeof value,
              value: primitive ? serialized.slice(0, 120) : undefined,
              serializedLength: serialized?.length ?? null,
            };
          }),
        });
      }
    } finally {
      database.close();
    }
  }
  return output;
})()`;

const result = await cdpRequest(page.webSocketDebuggerUrl, "Runtime.evaluate", {
  expression,
  returnByValue: true,
  awaitPromise: true,
});
if (result.exceptionDetails) {
  throw new Error(JSON.stringify(result.exceptionDetails));
}
console.log(JSON.stringify(result.result?.value ?? result.result, null, 2));
