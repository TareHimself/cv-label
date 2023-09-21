import { ComputerVisionLabeler } from "@frontend/cv/labelers";
import { CvLabel, ECVModelType, ValueOf } from "@types";
import { useEffect, useState } from "react";
import LabelOverlay from "./LabelOverlay";

export type BoxContainerProps<T extends ValueOf<typeof ECVModelType>> = {
  imagePath: string;
  labeler: ComputerVisionLabeler<T>;
};

export default function BoxContainer<T extends ValueOf<typeof ECVModelType>>(
  props: BoxContainerProps<T>
) {
  const labeler = props.labeler;

  const [labels, setLabels] = useState<CvLabel[]>([]);

  const [inferedImage, setInferedImage] = useState<HTMLImageElement | null>(
    null
  );

  const [recalculate, setRecalculate] = useState(0);

  useEffect(() => {
    labeler.loadModel("yolo-d.onnx").then((a) => {
      if (a) {
        labeler.predict(props.imagePath).then((r) => {
          if (r) {
            setLabels(r);
          }
        });
      }
    });
  }, [labeler, props.imagePath]);

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

  return (
    <div style={{ position: "relative", height: "fit-content" }}>
      <img
        src={`app://file/${props.imagePath}`}
        alt="img"
        ref={(r) => {
          setInferedImage(r);
        }}
        style={{
          width: "100%",
          height: "auto",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <LabelOverlay
          labels={labels}
          key={recalculate}
          image={{
            drawHeight: inferedImage?.height ?? -1,
            drawWidth: inferedImage?.width ?? -1,
            naturalHeight: inferedImage?.naturalHeight ?? -1,
            naturalWidth: inferedImage?.naturalWidth ?? -1,
          }}
          onLabelUpdated={(idx,u)=> {
            setLabels((c) => {
              c[idx] = u
              return [...c]
            })
          }}
        />
      </div>
    </div>
  );
}
