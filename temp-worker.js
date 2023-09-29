/* eslint-disable @typescript-eslint/no-var-requires */

    const { isMainThread, parentPort } = require("worker_threads");
    
    class WorkerBridge {
      handleEvent(event, handler) {
        parentPort.on("message", async (d) => {
          if (d.event === event) {
            const result = await handler(...d.args);
            parentPort.postMessage({
              event: d.event,
              id: d.id,
              result: result,
            });
          }
        });
      }
    }
    
    if (!isMainThread) {
      parentPort?.once("message", (data) => {
        const func = eval(data.f);
        func(new WorkerBridge(), ...data.args);
      });
    }
    