import DialogBox from "@components/DialogBox";
import { closeDialog } from "@frontend/dialog";
import { activateProject } from "@redux/exports";
import { useAppDispatch } from "@redux/hooks";
import { IProject } from "@types";
import React, { useEffect, useState } from "react";
import { NavigateFunction } from "react-router-dom";

export type OpenProjectDialogProps = {
  dialogId: string;
  navigate: NavigateFunction;
};
export default function OpenProjectDialog(props: OpenProjectDialogProps) {
  const [projects, setProjects] = useState<IProject[]>([]);

  const dispatch = useAppDispatch();
  useEffect(() => {
    window.bridge.getProjects().then((c) => setProjects(c));
  }, []);
  return (
    <DialogBox
      onCloseRequest={() => {
        closeDialog(props.dialogId);
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 300,
          gap: 20,
        }}
      >
        {projects.map((p) => (
          <button
            onClick={async () => {
              await dispatch(activateProject({
                projectId: p.id
              }))
              props.navigate(`/projects/${p.id}`);
              closeDialog(props.dialogId);
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
    </DialogBox>
  );
}
