

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

/**
 * HSV to RGB color conversion
 *
 * H runs from 0 to 360 degrees
 * S and V run from 0 to 100
 * 
 * Ported from the excellent java algorithm by Eugene Vishnevsky at:
 * http://www.cs.rit.edu/~ncs/color/t_convert.html
 */
export function hsvToRgb(h: number, s: number, v: number): [number,number,number] {
  let r: number, g: number, b: number;

  // Make sure our arguments stay in-range
  h = Math.max(0, Math.min(360, h));
  s = Math.max(0, Math.min(100, s));
  v = Math.max(0, Math.min(100, v));

  // We accept saturation and value arguments from 0 to 100 because that's
  // how Photoshop represents those values. Internally, however, the
  // saturation and value are calculated from a range of 0 to 1. We make
  // That conversion here.
  s /= 100;
  v /= 100;

  if (s == 0) {
    // Achromatic (grey)
    r = g = b = v;
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  h /= 60; // sector 0 to 5
  const i = Math.floor(h);
  const f = h - i; // factorial part of h
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));

  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;

    case 1:
      r = q;
      g = v;
      b = p;
      break;

    case 2:
      r = p;
      g = v;
      b = t;
      break;

    case 3:
      r = p;
      g = q;
      b = v;
      break;

    case 4:
      r = t;
      g = p;
      b = v;
      break;

    default: // case 5:
      r = v;
      g = p;
      b = q;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const maxUniqueColors = 70
let sv = 70
let generated = 0;
/**
 * Generate distinct RGB colors by generating untill we have generated "360 * 5" colors then starting from the begining
 */
export function uniqueRgbColor() {
  // distribute the colors evenly on
  // the hue range (the 'H' in HSV)
  const i = 360 / (maxUniqueColors - 1);

  sv = sv > 90 ? 70 : sv+10;

  generated = ++generated % maxUniqueColors;
  
  return hsvToRgb(i * generated, sv, sv)
}

const MAX_RGB_INDEX = 255 * 255 * 255

function indexToRGB(i: number) {
  if (i < 0 || i > MAX_RGB_INDEX) {
    throw new Error(`Index should be within the range of 0 to ${MAX_RGB_INDEX}`);
  }

  const r = (i >> 16) & 255;
  const g = (i >> 8) & 255;
  const b = i & 255;

  return [r, g, b];
}

let generationIdx = 0;
export function generateHitId(){
  return indexToRGB(generationIdx++).join(',')
}

export function subscribeToElementEvent<Target extends HTMLElement,E extends keyof HTMLElementEventMap>(element: Target, event: E,  listener: (this: HTMLElement, ev: HTMLElementEventMap[E]) => void){
  element.addEventListener(event,listener);

  return () => {
    element.removeEventListener(event,listener);
  }
}

export function subscribeToWindowEvent<E extends keyof WindowEventMap>(event: E,  listener: (this: Window, ev: WindowEventMap[E]) => void){
  window.addEventListener(event,listener);

  return () => {
    window.removeEventListener(event,listener);
  }
}

/**
 * Watches for "mousemove" events till we release the mouse
 * @param onMove 
 * @param onMouseUp 
 */
export function watchMouseMovement(onMove: (this: Window, ev: MouseEvent) => void,onMouseUp?: (ev: MouseEvent) => void){
  const unsubscribeMove = subscribeToWindowEvent('mousemove',onMove)

  const unsubscribeUp = subscribeToWindowEvent("mouseup",(e) => {
      unsubscribeMove();
      unsubscribeUp();
      if(onMouseUp !== undefined){
          onMouseUp(e);
      }
  })
}

