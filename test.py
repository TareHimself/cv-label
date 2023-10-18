import torch
import cv2
import torchvision
import numpy as np
from yolo_utils import non_max_suppression, process_mask_upsample, scale_boxes

x = cv2.imread("sample2.jpg")
modu = torch.jit.load("seg.torchscript")


def get_padding(image):
    max_w = 1203
    max_h = 1479

    imsize = image.size
    h_padding = (max_w - imsize[0]) / 2
    v_padding = (max_h - imsize[1]) / 2
    l_pad = h_padding if h_padding % 1 == 0 else h_padding + 0.5
    t_pad = v_padding if v_padding % 1 == 0 else v_padding + 0.5
    r_pad = h_padding if h_padding % 1 == 0 else h_padding - 0.5
    b_pad = v_padding if v_padding % 1 == 0 else v_padding - 0.5

    padding = (int(l_pad), int(t_pad), int(r_pad), int(b_pad))


# weights = torch.load("detection.pt")
# print(weights["weights"])

original_size = x.shape

img_h, img_w, img_c = x.shape
input = torch.from_numpy(x)

input = input.transpose(0, 2).transpose(1, 2).unsqueeze(0)

maxDim = max(img_w, img_h)
hw = (maxDim - img_w) / 2
hh = (maxDim - img_h) / 2
print(maxDim, img_h, img_w, hh, hw)
input = torch.nn.functional.interpolate(
    torch.nn.functional.pad(
        input,
        [
            int(hw),
            int(hw),
            int(hh),
            int(hh),
        ],
    ),
    [640, 640],
)

torchvision.io.write_png(input.squeeze(0), "hope.png")
input = input.float() / 255
with torch.no_grad():
    output,masks = modu(input)

    preds = non_max_suppression(prediction=output,nc=2)

    pred = preds[0]

    print(pred.shape)

    masks = process_mask_upsample(masks[0], pred[:, 6:], pred[:, :4], [img_h,img_w])  # HWC

    pred[:, :4] = scale_boxes([640, 640], pred[:, :4], [img_h, img_w])

    result = pred.numpy().tolist()


# # cv2.imshow("Padded", x)
# # cv2.waitKey()
