import * as torch from "@nodeml/torch";

export function clipBoxes(boxes: torch.Tensor<"float">, shape: number[]) {
  boxes.get("...", 0).clamp(0, shape[1]);
  boxes.get("...", 1).clamp(0, shape[0]);
  boxes.get("...", 2).clamp(0, shape[1]);
  boxes.get("...", 3).clamp(0, shape[0]);
  return boxes;
}

export function scaleBoxes(
  img1Shape: number[],
  boxes: torch.Tensor<"float">,
  img0Shape: number[]
) {
  const maxDim = Math.max(...img0Shape);
  const diffX = Math.floor((maxDim - img0Shape[1]) / 2);
  const diffY = Math.floor((maxDim - img0Shape[0]) / 2);
  console.log("Max", maxDim);
  for (let idx = 0; idx < boxes.shape[0]; idx++) {
    const box = boxes.get(idx);
    box.set(box.get(0).div(img1Shape[1]).mul(maxDim).sub(diffX), 0);
    box.set(box.get(1).div(img1Shape[0]).mul(maxDim).sub(diffY), 1);
    box.set(box.get(2).div(img1Shape[1]).mul(maxDim).sub(diffX), 2);
    box.set(box.get(3).div(img1Shape[0]).mul(maxDim).sub(diffY), 3);
    boxes.set(box, idx);
  }

  return clipBoxes(boxes, img0Shape);
}
export function xywh2xyxy(x: torch.Tensor<"float">) {
  const y = torch.emptyLike(x);
  const dw = x.get("...", 2).div(2); // half-width
  const dh = x.get("...", 3).div(2); // half-height
  y.set(x.get("...", 0).sub(dw), "...", 0); // top left x
  y.set(x.get("...", 1).sub(dh), "...", 1); // top left y
  y.set(x.get("...", 0).add(dw), "...", 2); // bottom right x
  y.set(x.get("...", 1).add(dh), "...", 3); // bottom right y
  return y;
}

export function nonMaxSuppression(
  prediction: torch.Tensor<"float">,
  conf_thres = 0.25,
  iou_thres = 0.45,
  agnostic = false,
  max_det = 300,
  max_time_img = 0.05,
  max_nms = 30000,
  max_wh = 7680
): torch.Tensor<"float">[] {
  const batchSize = prediction.shape[0];
  const numClasses = prediction.shape[1] - 4;
  const numMask = prediction.shape[1] - numClasses - 4;
  const maskStartIndex = 4 + numClasses;
  const candidates = torch.greater(
    prediction.get([], [4, maskStartIndex]).amax(1),
    conf_thres
  );

  prediction = prediction.transpose(-1, -2); // shape(1,84,6300) to shape(1,6300,84)
  prediction.set(xywh2xyxy(prediction.get("...", [null, 4])), "...", [null, 4]); // xywh to xyxy

  const output = new Array(batchSize).map(() => torch.zeros([0, 6 + numMask]));

  for (let idx = 0; idx < prediction.shape[0]; idx++) {
    let x = prediction.get(idx);
    x = x.get(candidates.get(idx));

    if (x.shape.length === 0) {
      continue;
    }

    const [box, cls, mask] = x.split([4, numClasses, numMask], 1);

    const [conf, j] = cls.max(1, true);

    x = torch
      .cat([box, conf, j.type(torch.types.float), mask], 1)
      .get(torch.greater(conf.view(-1), conf_thres));

    const n = x.shape[0];

    if (n === undefined) continue;

    if (n > max_nms) {
      x = x.get(x.get([], [null, 4]).argsort(-1, true));
    }

    const c = x.get([], [5, 6]).mul(agnostic ? 0 : max_wh);
    const [boxes, scores] = [
      x.get([], [null, 4]).add(c) as torch.Tensor<"float">,
      x.get([], 4),
    ];
    let i = torch.vision.ops.nms(boxes, scores, iou_thres);
    i = i.get([null, max_det]);
    // console.log("SHAPES", boxes.shape, scores.shape, boxes.dtype, scores.dtype);
    // let i = boxes;
    // i = i.get([], max_det);
    output[idx] = x.get(i);
  }

  return output;
}
