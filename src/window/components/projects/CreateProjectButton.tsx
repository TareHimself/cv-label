import { useDisclosure } from "@mantine/hooks";
import { Modal, Button, TextInput, Stack } from "@mantine/core";
import { useProjectsState } from "@hooks/useProjectsState";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useEditorState } from "@hooks/useEditorState";

export const CreateProjectButton = () => {
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const createProject = useProjectsState((s) => s.create);
  const activateProject = useEditorState((s) => s.activateProject);
  const [projectName, setProjectName] = useState("");
  return (
    <>
      <Modal opened={opened} onClose={close} title="Create Project" centered>
        <Stack gap={"md"}>
          <TextInput
            label="Project Name"
            placeholder="New Fun Project"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <Button
            onClick={async () => {
              const projectId = await createProject(projectName);
              if (projectId === undefined) return;

              await activateProject(projectId);

              navigate(`/projects/${projectId}`);

              close();
            }}
            justify="center"
          >
            Create
          </Button>
        </Stack>
      </Modal>

      <Button variant="default" onClick={open}>
        Create Project
      </Button>
    </>
  );
};
