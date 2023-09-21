import React, { PropsWithChildren } from "react";

export type EditorActionPanelProps = PropsWithChildren<{
  position: "top" | "bottom" | "left" | "right";
}>;
export default function EditorActionPanel(props: EditorActionPanelProps) {
  return (
    <div className="editor-action-panel" data-pos={props.position}>
      {props.children}
    </div>
  );
}
