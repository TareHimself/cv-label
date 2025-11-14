import { useDisclosure } from "@mantine/hooks";
import { Modal, Button, TextInput } from "@mantine/core";
import { useProjectsState } from "@hooks/useProjectsState";
import DialogBoxLabeledItem from "@components/DialogBoxLabeledItem";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useEditorState } from "@hooks/useEditorState";

export const CreateProjectButton = () => {
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const createProject = useProjectsState((s) => s.create);
  const activateProject = useEditorState((s) => s.activateProject)
  const [projectName, setProjectName] = useState("");
  return (
    <>
      <Modal opened={opened} onClose={close} title="Create Project" centered>
        <TextInput label="Project Name" placeholder="New Fun Project" value={projectName} onChange={(e) => setProjectName(e.target.value)}/>
          <Button onClick={async () => {
            const projectId = await createProject(projectName)
            if(projectId === undefined) return

            await activateProject(projectId)

            navigate(`/projects/${projectId}`);
            
            close();
          }}
          justify="center"
          >Create</Button>
        {/* <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 500,
            gap: 20,
          }}
        >
          <DialogBoxLabeledItem label="Project Name">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Name your project"
            />
          </DialogBoxLabeledItem>
          <div />
          <button
            onClick={() => {
              createProject(projectName).then((a) => {
                if (a !== undefined) {
                  navigate(`/projects/${a}`);
                  close();
                }
              });
            }}
            style-border="true"
          >
            Create
          </button>
        </div> */}
        {/* Modal without header, press escape or click on overlay to close */}
      </Modal>

      <Button variant="default" onClick={open}>
        Create Project
      </Button>
    </>
  );
};
