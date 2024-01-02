import { IActiveContextMenu } from "./types";
import { useAppSelector, setContextMenu, store } from "./redux";
import { CONTEXT_MENU_WIDTH } from "./constants";
import { Provider } from "react-redux";
import contextMenuContext from "./redux/context";
import { useCallback } from "react";

function RenderContextMenuItems<TData>({
  data,
}: {
  data: IActiveContextMenu<TData>;
}) {
  return (
    <div
      className="context-menu"
      style={{
        top: data.position.y,
        left: data.position.x,
        width: `${CONTEXT_MENU_WIDTH}px`,
      }}
    >
      {data.options.map((a,idx) => {
        return (
          <div
            className="context-menu-item"
            onClick={() => a.callback(data.data)}
            key={`${idx}`}
          >
            <h2>{a.name}</h2>
          </div>
        );
      })}
    </div>
  );
}

function ContextMenus() {
  const contextMenu = useAppSelector((s) => s.main.contextMenu);

  const tryRemoveMenu = useCallback((e: React.MouseEvent<HTMLDialogElement>) => {
    if(e.target === e.currentTarget){
      store.dispatch(setContextMenu(null));
    }
  },[])

  if (!contextMenu) {
    return <></>;
  }

  return (
    <dialog
      ref={(r) => {
        if (!r?.open) {
          r?.showModal();
        }
      }}
      style={{ background: 'transparent',
      width: '100%',
      height: '100%',
      maxWidth: '100vw',
      maxHeight: '100vh',
      padding: '0px',
      margin: '0px',
      border: 'none' }}
      onClick={tryRemoveMenu}
      onContextMenu={tryRemoveMenu}
      className="_context-menu-dialog"
    >
      <RenderContextMenuItems<unknown> data={contextMenu} />
    </dialog>
  );
}

export default function ContextMenuManager() {
  return (
    <Provider store={store} context={contextMenuContext}>
      <ContextMenus />
    </Provider>
  );
}
