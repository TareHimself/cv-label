import { useAppSelector } from "@redux/hooks";
import { SidePanelIds } from "@types";
import React, { PropsWithChildren } from "react";

export type SidePanelProps = PropsWithChildren<{
  name: string;
  id: SidePanelIds;
}>;
export default function SidePanel(props: SidePanelProps) {

  const sidePanelId = useAppSelector(s => s.app.currentSidePanel);

  return (
    <div className="side-panel" data-is-open={props.id === sidePanelId}>
      <div className="side-panel-header">
        <h2>{props.name}</h2>
      </div>
      <div className="side-panel-content">{props.children}</div>
    </div>
  );
}
