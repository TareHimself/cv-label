import { useDisclosure } from "@mantine/hooks";
import { Modal, Button } from "@mantine/core";
import { useProjectsState } from "@hooks/useProjectsState";
import { useEditorState } from "@hooks/useEditorState";
import { useNavigate } from "react-router-dom";

export const OpenProjectButton = () => {
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const projects = useProjectsState((s) => s.projects);
  const activateProject = useEditorState((s) => s.activateProject);
  return (
    <>
      <Modal opened={opened} onClose={close} title="Open Project" display={'flex'}>
        {projects.map((p) => (
            <Button  justify="center" fullWidth key={p.id} onClick={async () => {
                activateProject(p.id);
                navigate(`/projects/${p.id}`);
                close();
              }}>
              {p.name}
            </Button>
          ))}
      </Modal>

      <Button justify="center" variant="default" onClick={open}>
        Open Project
      </Button>
    </>
  );
};
