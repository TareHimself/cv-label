import { useRef } from "react";
import BoxContainer from "@components/editor/BoxContainer";
import {
  YoloV8DetectLabeler,
  YoloV8SegmentLabeler,
} from "@frontend/cv/labelers/yolo";

export default function App() {
  const labeler = useRef(new YoloV8DetectLabeler()).current;

  return <BoxContainer imagePath="./test.jpg" labeler={labeler} />;
}
