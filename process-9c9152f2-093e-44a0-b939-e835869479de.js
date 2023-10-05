/* eslint-disable @typescript-eslint/no-var-requires */
    class WorkerBridge {
      handleEvent(event, handler) {
        process.on("message", async (d) => {
          if (d.event === event) {
            const result = await handler(...d.args);
            process.send({
              event: d.event,
              id: d.id,
              result: result,
            });
          }
        });
      }
    }
    
    process.once("message", (data) => {
      const func = eval(data.f);
      func(new WorkerBridge(), ...data.args);
    });
    