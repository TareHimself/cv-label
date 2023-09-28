export function union(box1: number[], box2: number[]) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;

  const box1_area = (box1_x2 - box1_x1) * (box1_y2 - box1_y1);
  const box2_area = (box2_x2 - box2_x1) * (box2_y2 - box2_y1);

  return box1_area + box2_area - intersection(box1, box2);
}

export function intersection(box1: number[], box2: number[]) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
  const x1 = Math.max(box1_x1, box2_x1);
  const y1 = Math.max(box1_y1, box2_y1);
  const x2 = Math.min(box1_x2, box2_x2);
  const y2 = Math.min(box1_y2, box2_y2);

  const area = (x2 - x1) * (y2 - y1);

  if (area < 0) {
    return 0;
  }

  return area;
}

export function iou(box1: number[], box2: number[]) {
  return intersection(box1, box2) / union(box1, box2);
}

export function overlapPercentage(box1: number[], box2: number[]) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;

  const x1 = Math.max(box1_x1, box2_x1);
  const y1 = Math.max(box1_y1, box2_y1);
  const x2 = Math.min(box1_x2, box2_x2);
  const y2 = Math.min(box1_y2, box2_y2);

  if (x1 <= x2 && y1 <= y2) {
    // const overlapWidth = x2 - x1
    // const overlapHeight = y2 - y1
    // const box1Width = box1_x2 - box1_x1
    // const box1Height = box1_y2 - box1_y1

    // if(overlapWidth / overlapHeight)
    return Math.min(
      ((x2 - x1) * (y2 - y1)) / ((box1_x2 - box1_x1) * (box1_y2 - box1_y1)),
      1
    );
  }

  return 0;
}

export function modAbs(val: number, target: number) {
  if (val < 0) {
    return (target - (Math.abs(val) % target)) % target;
  } else {
    return val % target;
  }
}

export function clamp(a: number, min: number, max: number) {
  return Math.max(Math.min(max, a), min);
}

export function wrap(a: number, min: number, max: number): number {
  if (a < min) {
    return wrap(max - (min - a), min, max);
  }

  if (a > max) {
    return wrap(a - max, min, max);
  }

  return a;
}

export function waitMouseRelease(callback: (e: MouseEvent) => void) {
  const midway = (e: MouseEvent) => {
    callback(e);
    window.removeEventListener("mouseup", callback);
  };

  window.addEventListener("mouseup", midway);
}
// console.log(overlapPercentage([0,0,1,1],[0,0,1.5,1.5]))
