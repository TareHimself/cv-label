import { Worker } from "worker_threads";
import * as fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { AsyncReturnType } from "@types";
import { fork, ChildProcess } from "child_process";

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

  const tempFilePath = path.join(process.cwd(), `worker-func-${uuidv4()}.js`);

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

export class WorkerController<Events extends WorkerProcessEvents> {
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

export async function createWorker<
  E extends WorkerProcessEvents,
  A extends unknown[]
>(
  func: (bridge: WorkerBridge<E>, ...args: A) => Promise<unknown>,
  ...args: A
): Promise<WorkerController<E>> {
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

  const tempFilePath = path.join(process.cwd(), `worker-${uuidv4()}.js`);

  await fs.promises.writeFile(tempFilePath, tempScript);

  const worker = new Worker(tempFilePath);

  worker.postMessage({
    f: func.toString(),
    args: args,
  });

  return new WorkerController(worker, tempFilePath);
}

export async function withNodeProcess<A extends unknown[], R>(
  func: (...args: A) => Promise<R>,
  ...args: A
): Promise<R> {
  const tempScript = `
  process.on("message", (data) => {
    const func = eval(data.f);
    func(...data.args).then((a) => process.send(a));
  });`;

  const tempFilePath = path.join(process.cwd(), `process-func-${uuidv4()}.js`);

  await fs.promises.writeFile(tempFilePath, tempScript);

  const worker = fork(tempFilePath);

  const removeTempScript = async () => {
    try {
      await fs.promises.unlink(tempFilePath);
    } catch (error) {
      /* empty */
    }
  };
  return new Promise<R>((res, rej) => {
    worker.on("message", async (d) => {
      res(d as unknown as R);
      await removeTempScript();
    });

    worker.on("error", async (e) => {
      rej(e);
      await removeTempScript();
    });

    worker.send({
      f: func.toString(),
      args: args,
    });
  });
}

declare class ProcessBridge<Events extends WorkerProcessEvents> {
  handleEvent: <E extends keyof Events>(event: E, handler: Events[E]) => void;
}

export class ProcessController<Events extends WorkerProcessEvents> {
  worker: ChildProcess;
  tempScriptPath: string;
  constructor(childProcess: ChildProcess, tempScriptPath: string) {
    this.worker = childProcess;
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
      this.worker.send({
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
    return this.worker.kill();
  }
}

export async function createProcess<
  E extends WorkerProcessEvents,
  A extends unknown[]
>(
  func: (bridge: ProcessBridge<E>, ...args: A) => Promise<unknown>,
  ...args: A
): Promise<ProcessController<E>> {
  const tempScript = `/* eslint-disable @typescript-eslint/no-var-requires */
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
    `;

  const tempFilePath = path.join(process.cwd(), `process-${uuidv4()}.js`);

  await fs.promises.writeFile(tempFilePath, tempScript);

  const worker = fork(tempFilePath);

  worker.send({
    f: func.toString(),
    args: args,
  });

  return new ProcessController(worker, tempFilePath);
}
