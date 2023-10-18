import * as torch from "@nodeml/torch";
import * as cv from "@nodeml/opencv"
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
  numClasses: number,
  conf_thres = 0.25,
  iou_thres = 0.45,
  agnostic = false,
  max_det = 300,
  max_time_img = 0.05,
  max_nms = 30000,
  max_wh = 7680,
): torch.Tensor<"float">[] {
  const batchSize = prediction.shape[0];
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

    output[idx] = x.get(i);
  }

  return output;
}

export function cropMask(
  masks: torch.Tensor<"float">,
  boxes: torch.Tensor<"float">
): torch.Tensor<"float"> {
  const [_, h, w] = masks.shape;
  const [x1, y1, x2, y2] = torch.chunk(boxes.get([], [], null), 4, 1); // x1 shape(n,1,1)
  const r = torch.arange(w, x1.dtype).get(null, null, []); // rows shape(1,1,w)
  const c = torch.arange(h, x1.dtype).get(null, [], null); // cols shape(1,h,1)
  const a1 = torch.greaterEqual(r, x1); //(r >= x1)
  const a2 = torch.less(r, x2); // (r < x2)
  const a3 = torch.greaterEqual(c, y1); // (c >= y1)
  const a4 = torch.less(c, y2); // (c < y2)
  return masks.mul(a1.mul(a2).mul(a3).mul(a4)) as torch.Tensor<"float">; // masks * ((r >= x1) * (r < x2) * (c >= y1) * (c < y2))
}

// def masks2segments_scaled(masks,original_size: tuple[int,int], strategy='largest'):
//     """
//     It takes a list of masks(n,h,w) and returns a list of segments(n,xy)

//     Args:
//         masks (torch.Tensor): the output of the model, which is a tensor of shape (batch_size, 160, 160)
//         original_size (tuple[int,int]): the original size of the image of shape (w,h)
//         strategy (str): 'concat' or 'largest'. Defaults to largest

//     Returns:
//         segments (List): list of segment masks
//     """
//     segments = []
//     saved = 0

//     max_dim = max(original_size)
//     diff_x = int((max_dim - original_size[0]) / 2)
//     diff_y = int((max_dim - original_size[1]) / 2)

//     for x in masks.int().cpu().numpy().astype('uint8'):
//         x = cv2.resize(x,(max_dim,max_dim),interpolation=cv2.INTER_CUBIC)[diff_y:diff_y + original_size[1], diff_x:diff_x + original_size[0]]
//         saved += 1
//         c = cv2.findContours(x * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]
//         if c:
//             if strategy == 'concat':  # concatenate all segments
//                 c = np.concatenate([x.reshape(-1, 2) for x in c])
//             elif strategy == 'largest':  # select largest segment
//                 c = np.array(c[np.array([len(x) for x in c]).argmax()]).reshape(-1, 2)

//             c = c.astype('int32')
//             peri = cv2.arcLength(c, True)
//             c = cv2.approxPolyDP(c, 0.006 * peri, True).reshape(-1, 2)
//         else:
//             c = np.zeros((0, 2))  # no segments found
//         segments.append(c)
//     return segments


export function masks2segmentsScaled(masks: torch.Tensor<'int32'>, originalSize: [number, number]) {
  const segments: [number, number][][] = []
  const maxDim = Math.max(...originalSize)
  const diffX = Math.round((maxDim - originalSize[0]) / 2)
  const diffY = Math.round((maxDim - originalSize[1]) / 2)
  for (let i = 0; i < masks.shape[0]; i++) {

    const mask = torch.nn.functional.interpolate(masks.get(i).unsqueeze(0).unsqueeze(0), [maxDim, maxDim], 'area').get(0).get(0).mul(255).clamp(0, 255).type('uint8').get([diffY, diffY + originalSize[1]], [diffX, diffX + originalSize[0]]).clone()
    
    const [maskH, maskW] = mask.shape;

    const mat = new cv.Mat(mask.toArray(), maskW, maskH, 1)
    
    const contours = cv.findContours(mat, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE).map(c => ({
      contour: c,
      arcLength: cv.arcLength(c, true)
    })).sort((a, b) => b.arcLength - a.arcLength)

    segments.push(cv.approxPolyDp(contours[0].contour, 0.006 * contours[0].arcLength, true))
  }

  return segments
}

export function processMaskUpsample(
  protos: torch.Tensor<"float">,
  masksIn: torch.Tensor<"float">,
  bboxes: torch.Tensor<"float">,
  shape: [number, number]
) {

  const [c, mh, mw] = protos.shape; // c, mh, mw = protos.shape  # CHW
  let masks = masksIn
    .matmul(protos.type("float").view(c, -1))
    .sigmoid()
    .view(-1, mh, mw)
    .type("float"); // masks = (masks_in @ protos.float().view(c, -1)).sigmoid().view(-1, mh, mw)
  masks = torch.nn.functional.interpolate(masks.get(null), shape, "bilinear", {
    alignCorners: false,
    antiAlias: false
  }).get(0); // masks = F.interpolate(masks[None], shape, mode='bilinear', align_corners=False)[0]  # CHW
  masks = cropMask(masks, bboxes); // masks = crop_mask(masks, bboxes)  # CHW
  return torch.greater(masks, 0.5).type("int32"); // masks.gt_(0.5)
}
