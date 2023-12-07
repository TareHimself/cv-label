import { v4 as uuidv4 } from "uuid";
import { store } from "./redux/store";
import { createDialog as reduxCreateDialog, useAppSelector } from "./redux";
import { DialogManagerProps, IActiveDialog } from "./types";
import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import dialogStoreContext from "./redux/context";

export function createDialog(dialog: IActiveDialog["render"]) {
  store.dispatch(
    reduxCreateDialog({
      data: {
        id: uuidv4(),
      },
      render: dialog,
    })
  );
  // [{
  //     data: {
  //         id: uuidv4(),
  //     },
  //     render: () => (<div style={{
  //         display: 'flex',
  //         flexDirection: 'column',
  //         width: 200,
  //         height: 100,
  //         backgroundColor: "blue",
  //     }}>

  //     </div>)
  //   }]
}

function DialogManagerChild(props: DialogManagerProps) {

    // const [dialogs,setDialogs] = useState<IActiveDialog[]>([]);
  const dialogs = useAppSelector((s) => {
    console.log("STORE",s)
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
