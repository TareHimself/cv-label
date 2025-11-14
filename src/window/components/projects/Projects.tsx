import { CreateProjectButton } from "./CreateProjectButton";
import { OpenProjectButton } from "./OpenProjectButton";

export default function Projects() {
  // const iconSize = 70;
  // const navigate = useNavigate();
  return (
    <>
    <div id="start">
      <CreateProjectButton/>
      <OpenProjectButton />
      {/* <div className="start-icon">
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
      </div> */}
    </div>
    </>
  );
}
