import React, { PropsWithChildren } from "react";

export type SidePanelProps = PropsWithChildren<{
  isOpen: boolean;
  name: string;
}>;
export default function SidePanel(props: SidePanelProps) {
  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h2>{props.name}</h2>
      </div>
      <div className="side-panel-content">{props.children}</div>
    </div>
  );
}
