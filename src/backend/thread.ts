// interface IWorkerPayload {
//   op: string;
//   data: string;
// }
// if (!isMainThread) {
//   parentPort?.on("message", (data) => {
//     const func = eval(data.f);
//     func(...data.args).then((a: unknown) => parentPort?.postMessage(a));
//   });
// }
