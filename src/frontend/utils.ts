export function waitMouseRelease(callback: (e: MouseEvent) => void) {
  const midway = (e: MouseEvent) => {
    callback(e);
    window.removeEventListener("mouseup", callback);
  };

  window.addEventListener("mouseup", midway);
}

type WorkerPayload = {
  op: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

export function withWebWorker<A extends unknown[], R>(
  func: (...args: A) => Promise<R>,
  ...args: A
): Promise<R> {
  const funcString = func.toString();

  //   const workerScript = `;

  //   self.onmessage = (d) => {
  //     if (d.data.op === "start") {
  //       const toCall = eval(d.data.data.func)

  //       const args = d.data.data.args

  //       toCall(...args)
  //         .then((r) => {
  //           self.postMessage({
  //             op: "result",
  //             data: r,
  //           });
  //         })
  //         .catch((e) => {
  //           self.postMessage({
  //             op: "error",
  //             data: e,
  //           });
  //         });
  //     }
  //   };`;

  const scriptFile = new Blob(
    [document.getElementById("worker-script")?.textContent ?? ""],
    {
      type: "text/javascript",
    }
  );

  const scriptUrl = URL.createObjectURL(scriptFile);

  const worker = new Worker(scriptUrl);

  return new Promise<R>((res, rej) => {
    worker.onmessage = (d: MessageEvent<WorkerPayload>) => {
      if (d.data.op === "result") {
        URL.revokeObjectURL(scriptUrl);
        res(d.data.data);
      } else if (d.data.op === "error") {
        URL.revokeObjectURL(scriptUrl);
        rej(d.data.data);
      } else {
        console.log(d.data);
      }
    };

    worker.postMessage({
      op: "start",
      data: {
        func: funcString,
        args: args,
      },
    });
  });
}
