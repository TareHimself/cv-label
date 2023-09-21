import { ComputerVisionLabeler } from "@frontend/cv/labelers";
import { CvLabel, ECVModelType, ValueOf } from "@types";
import { useEffect, useState } from "react";
import LabelOverlay from "./LabelOverlay";
import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import { editLabel } from "@redux/exports";

export default function BoxContainer() {
  const dispatch = useAppDispatch();

  const currentSample = useAppSelector(
    (s) => s.editor.samples[s.editor.currentSampleIndex]
  );

  const [inferedImage, setInferedImage] = useState<HTMLImageElement | null>(
    null
  );

  const [recalculate, setRecalculate] = useState(0);

  // useEffect(() => {
  //   labeler.loadModel("yolo-d.onnx").then((a) => {
  //     if (a) {
  //       labeler.predict(props.imagePath).then((r) => {
  //         if (r) {
  //           setLabels(r);
  //         }
  //       });
  //     }
  //   });
  // }, [labeler, props.imagePath]);

  // useEffect(() => {
  //   labeler.loadModel("yolo-seg.onnx").then((a) => {
  //     if (a) {
  //       labeler.predict(props.imagePath).then((r) => {
  //         if (r) {
  //           setLabels(r);
  //         }
  //       });
  //     }
  //   });
  // }, [labeler, props.imagePath]);

  useEffect(() => {
    if (inferedImage) {
      const observer = new ResizeObserver(() => setRecalculate((d) => d + 1));

      observer.observe(inferedImage);
      return () => {
        observer.disconnect();
      };
    }
  }, [inferedImage]);

  if (currentSample === undefined) {
    return <></>;
  }

  return (
    <div id={"label-box"}>
      <img
        src={`app://file/${currentSample.path}`}
        alt="img"
        ref={(r) => {
          setInferedImage(r);
        }}
      />
      {inferedImage && (
        <LabelOverlay
          labels={currentSample.labels}
          key={recalculate}
          image={inferedImage}
          onLabelUpdated={(idx, u) => {
            dispatch(editLabel([idx, u]));
          }}
        />
      )}
    </div>
  );
}
