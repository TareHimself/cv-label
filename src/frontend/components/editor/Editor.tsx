import React, { useRef, useState } from "react";
import EditorActionPanel from "./EditorActionPanel";
import { AiOutlineZoomIn, AiOutlineZoomOut } from "react-icons/ai";
import { BsBoundingBoxCircles } from "react-icons/bs";
import { PiPolygonLight, PiHandPalmBold } from "react-icons/pi";
import { MdAutoAwesome } from "react-icons/md";
import BoxContainer from "./BoxContainer";
import { YoloV8SegmentLabeler } from "@frontend/cv/labelers/yolo";
import ActionPanelIcon from "./ActionPanelIcon";

export default function Editor() {
  const labeler = useRef(new YoloV8SegmentLabeler()).current;

  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);

  return (
    <div id={"editor"}>
      <div
        className="editor-layer"
        style={{
          boxSizing: "border-box",
          padding: "15px",
          justifyContent: "center",
          backgroundColor: "#454343",
        }}
      >
        <BoxContainer />
      </div>
      <div className="editor-layer">
        <EditorActionPanel position="bottom">
          <ActionPanelIcon icon={AiOutlineZoomIn} />
          <ActionPanelIcon icon={AiOutlineZoomOut} />
        </EditorActionPanel>
        <EditorActionPanel position="right">
          <ActionPanelIcon icon={PiHandPalmBold} />
          <ActionPanelIcon icon={BsBoundingBoxCircles} />
          <ActionPanelIcon icon={PiPolygonLight} />
          <ActionPanelIcon
            icon={MdAutoAwesome}
            onClicked={() => {
              setIsModelSelectOpen(true);
            }}
          />
        </EditorActionPanel>
      </div>
    </div>
  );
}
