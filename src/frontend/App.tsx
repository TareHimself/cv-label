import { useRef } from "react";
import BoxContainer from "@components/editor/BoxContainer";
import {
  YoloV8DetectLabeler,
  YoloV8SegmentLabeler,
} from "@frontend/cv/labelers/yolo";
import Editor from "@components/editor/Editor";

export default function App() {
  return <Editor />;
}
