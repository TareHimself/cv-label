import { Worker } from "worker_threads";
import * as fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { AsyncReturnType } from "@types";

export async function withNodeWorker<A extends unknown[], R>(
  func: (...args: A) => Promise<R>,
  ...args: A
): Promise<R> {
  const tempScript = `
    const {  Worker, isMainThread, parentPort } = require('worker_threads')
    if(!isMainThread){
        parentPort?.on('message',(data) => {
            const func = eval(data.f)
            func(...data.args).then((a) => parentPort?.postMessage(a))
        })
    }`;

  const tempFilePath = path.join(process.cwd(), `worker-${uuidv4()}.js`);

  await fs.promises.writeFile(tempFilePath, tempScript);

  const worker = new Worker(tempFilePath);

  const removeTempScript = async () => {
    try {
      await fs.promises.unlink(tempFilePath);
    } catch (error) {
      /* empty */
    }
  };
  return new Promise<R>((res, rej) => {
    worker.on("message", async (d) => {
      res(d);
      await worker.terminate();
      await removeTempScript();
    });

    worker.on("error", async (e) => {
      rej(e);
      await worker.terminate();
      await removeTempScript();
    });

    worker.postMessage({
      f: func.toString(),
      args: args,
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorkerProcessEvents = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in string]: (...args: any[]) => Promise<any>;
};

declare class WorkerBridge<Events extends WorkerProcessEvents> {
  handleEvent: <E extends keyof Events>(event: E, handler: Events[E]) => void;
}

export class WorkerProcess<Events extends WorkerProcessEvents> {
  worker: Worker;
  tempScriptPath: string;
  constructor(worker: Worker, tempScriptPath: string) {
    this.worker = worker;
    this.tempScriptPath = tempScriptPath;
  }

  async call<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>) {
    const callId = uuidv4();
    return new Promise<AsyncReturnType<Events[E]>>((res) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callback = (d: any) => {
        if (d.event === event && d.id === callId) {
          res(d.result);
          this.worker.off("message", callback);
        }
      };

      this.worker.on("message", callback);
      this.worker.postMessage({
        event: event,
        id: callId,
        args: args,
      });
    });
  }

  async stop() {
    try {
      await fs.promises.unlink(this.tempScriptPath);
    } catch (error) {
      /* empty */
    }
    return await this.worker.terminate();
  }
}

export async function createWorkerProcess<
  E extends WorkerProcessEvents,
  A extends unknown[]
>(
  func: (bridge: WorkerBridge<E>, ...args: A) => Promise<unknown>,
  ...args: A
): Promise<WorkerProcess<E>> {
  const tempScript = `/* eslint-disable @typescript-eslint/no-var-requires */

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
    `;

  const tempFilePath = path.join(process.cwd(), "temp-worker.js");

  await fs.promises.writeFile(tempFilePath, tempScript);

  const worker = new Worker(tempFilePath);

  worker.postMessage({
    f: func.toString(),
    args: args,
  });

  return new WorkerProcess(worker, tempFilePath);
}
