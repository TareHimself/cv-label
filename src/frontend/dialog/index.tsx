import { v4 as uuidv4 } from "uuid";
import { store } from "./redux/store";
import { createDialog as reduxCreateDialog, useAppSelector , closeDialog as reduxCloseDialog} from "./redux";
import { DialogManagerProps, IActiveDialog } from "./types";
import { Provider } from "react-redux";
import dialogStoreContext from "./redux/context";
import "./styles.css"
export function createDialog(dialog: IActiveDialog["render"]) {
  const dialogId = uuidv4();

  store.dispatch(
    reduxCreateDialog({
      data: {
        id: dialogId,
      },
      render: dialog,
    })
  );

  return dialogId
}


export function closeDialog(dialogId: string) {
  store.dispatch(
    reduxCloseDialog(dialogId)
  );
}

function DialogManagerChild(props: DialogManagerProps) {

    // const [dialogs,setDialogs] = useState<IActiveDialog[]>([]);
  const dialogs = useAppSelector((s) => {
    return s.dialog.dialogs
  });


  // useEffect(()=>{
  //   return store.subscribe(()=>{
  //       setDialogs([...store.getState().dialog.dialogs]);
  //   })
  // },[])

  return (
    <>
      {props.children}
      {dialogs.map((d) => {
        const RenderFn = d.render;

        return (
          <dialog
            className="_dialog-container"
            ref={(r) => {
              if(!r?.open){
                r?.showModal()
              }
            }}
            key={d.data.id}
            style={{ ...(props.defaultStyle ?? {}), ...(d.data.style ?? {}) }}
          >
            <RenderFn {...d.data} />
          </dialog>
        );
      })}
      
    </>
  );
}
export default function DialogManager(props: DialogManagerProps) {
  return (
    <Provider store={store} context={dialogStoreContext}>
      <DialogManagerChild {...props} />
    </Provider>
  );
}
