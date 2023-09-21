import numpy as np
import torch
from yolo_utils import non_max_suppression, process_mask_upsample, scale_boxes, masks2segments_scaled

def exec_python(python_string: str):
    exec('global i; i = %s' % python_string,globals())
    global i
    return i


def format_detect_result(out0: list[list[float],list[int]],original_dims: tuple[int,int],inference_dims: tuple[int,int]):
    out0_arr,out0_dims = out0

    x = torch.from_numpy(np.array(out0_arr).reshape(*out0_dims))

    num_classes = out0_dims[1] - 4

    preds = non_max_suppression(prediction=x,nc=num_classes)

    pred = preds[0]

    pred[:, :4] = scale_boxes(inference_dims[::-1], pred[:, :4],original_dims[::-1])

    return {
            "boxes": pred.numpy().tolist()
        }


def format_seg_results(out0: list[list[float],list[int]],out1: list[list[float],list[int]],original_dims: tuple[int,int],inference_dims: tuple[int,int]):
    out0_arr,out0_dims = out0
    out1_arr,out1_dims = out1

    x = torch.from_numpy(np.array(out0_arr).reshape(*out0_dims)).type(torch.FloatTensor)

    y = torch.from_numpy(np.array(out1_arr).reshape(*out1_dims)).type(torch.FloatTensor)

    

    num_classes = out0_dims[1] - (4 + 32)

    p = non_max_suppression(prediction=x,nc=num_classes)


    # proto = y[1][-1] if len(y[1]) == 3 else y[1]  # second output is len 3 if pt, but only 1 if exported

    proto = y[0]

    pred = p[0]

    if not len(pred):  # save empty boxes
        masks = None
    else:
        masks = process_mask_upsample(proto, pred[:, 6:], pred[:, :4], inference_dims[::-1])  # HWC
        pred[:, :4] = scale_boxes(inference_dims[::-1], pred[:, :4], original_dims[::-1])

    # new_segments = []
    # for segment in masks2segments(masks):
    #     new_segment = []
    #     for point in segment.tolist():
    #         x1 = (point[0]/ m_w) * original_dims[0]
    #         y1 = (point[1] / m_h) * original_dims[1]
    #         new_segment.append([x1,y1])

    #     new_segments.append(new_segment)

    return {
            "boxes": pred[:, :6].numpy().tolist(),
            "masks": [x.tolist() for x in masks2segments_scaled(masks,original_dims)],
        }