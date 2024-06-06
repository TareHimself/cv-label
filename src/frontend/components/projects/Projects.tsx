import Icon from "@components/Icon";
import { createDialog } from "@frontend/dialog";
import { useAppDispatch } from "@redux/hooks";
import { activateProject} from "@redux/slices/app";
import { AiOutlinePlus, AiFillFolderOpen } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import CreateProjectDialog from "./CreateProjectDialog";
import OpenProjectDialog from "./OpenProjectDialog";

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
          tooltip="Create a new project"
          onClicked={() => {
            createDialog((p)=>{
              return <CreateProjectDialog dialogId={p.id} navigate={navigate}/>
            })
          }}
        />
        <h3>New Project</h3>
      </div>
      <div className="start-icon">
        <Icon
          icon={AiFillFolderOpen}
          iconSize={iconSize}
          tooltip="Open an existing project"
          onClicked={() => {
            createDialog((p)=>{
              return <OpenProjectDialog dialogId={p.id} navigate={navigate}/>
            })
          }}
        />
        <h3>Open Project</h3>
      </div>
    </div>
  );
}
