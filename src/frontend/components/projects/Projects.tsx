import Icon from "@components/Icon";
import { useAppDispatch } from "@redux/hooks";
import { activateProject, createProject } from "@redux/slices/projects";
import { AiOutlinePlus, AiFillFolderOpen } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

export default function Projects() {
  const iconSize = 70;

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return (
    <div id="start">
      <div className="start-icon">
        <Icon
          icon={AiOutlinePlus}
          iconSize={iconSize}
          onClicked={() => {
            dispatch(
              createProject({
                projectName: "Test Project",
              })
            ).then((a) => {
              const projectId = a.payload as string;
              navigate(`/projects/${projectId}`);
            });
          }}
        />
        <h3>New Project</h3>
      </div>
      <div className="start-icon">
        <Icon
          icon={AiFillFolderOpen}
          iconSize={iconSize}
          onClicked={async () => {
            await dispatch(activateProject({
              projectId: "01e9b828de4b4dffa3e44255e33f08d7"
            }))

            navigate(`/projects/01e9b828de4b4dffa3e44255e33f08d7`)
          }}
        />
        <h3>Open Project</h3>
      </div>
    </div>
  );
}
