import { Worker, isMainThread, parentPort } from 'worker_threads'

interface IWorkerPayload {
    op: string
    data: string
}
if(!isMainThread){
    parentPort?.on('message',(data) => {
        const func = eval(data.f)
        func(...data.args).then((a: unknown) => parentPort?.postMessage(a))
    })
}



export function runInWorker<A extends unknown[],R extends unknown>(func: (...args: A) => Promise<R>,...args: A): Promise<R> {
    const worker = new Worker(__filename)

    return new Promise<R>((res)=>{
        worker.on('message',(d) => {
            res(d)
        })

        worker.postMessage({
            f: func.toString(),
            args: args
        })
    })
}
