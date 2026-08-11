const port = Number(process.argv[2] ?? 9222);

function createClient(webSocketDebuggerUrl) {
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
    clearTimeout(waiter.timeout);
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
    request(method, params = {}, sessionId = undefined) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${method} timed out`));
        }, 5000);
        pending.set(id, { resolve, reject, timeout });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    close() {
      socket.close();
    },
  };
}

const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
if (!version.webSocketDebuggerUrl) {
  throw new Error("Browser debugger endpoint not found");
}

const client = createClient(version.webSocketDebuggerUrl);
await client.ready;
const reports = [];

try {
  const { targetInfos } = await client.request("Target.getTargets");
  for (const target of targetInfos.filter((candidate) => candidate.type === "worker")) {
    let sessionId;
    try {
      ({ sessionId } = await client.request("Target.attachToTarget", {
        targetId: target.targetId,
        flatten: true,
      }));
      await client.request("Runtime.runIfWaitingForDebugger", {}, sessionId);
      await client.request("Runtime.enable", {}, sessionId);
      const evaluation = await client.request("Runtime.evaluate", {
        expression: `({
          location: self.location?.href ?? null,
          hasC3: typeof self.C3 !== "undefined",
          c3Keys: typeof self.C3 === "undefined" ? [] : Object.keys(self.C3).slice(0, 100),
          fastCestoRuntime: typeof self.FastCestoRuntime,
          globalRuntime: typeof self.runtime,
          globals: Object.keys(self).filter(key => /runtime|construct|c3/i.test(key)).slice(0, 100)
        })`,
        returnByValue: true,
      }, sessionId);
      reports.push({
        target,
        evaluation: evaluation.result?.value ?? evaluation.result,
        exceptionDetails: evaluation.exceptionDetails ?? null,
      });
    } catch (error) {
      reports.push({ target, error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (sessionId) {
        try {
          await client.request("Target.detachFromTarget", { sessionId });
        } catch {
          // The target may have exited between inspection and detach.
        }
      }
    }
  }
} finally {
  client.close();
}

console.log(JSON.stringify(reports, null, 2));
