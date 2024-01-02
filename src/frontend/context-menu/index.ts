import ContextMenuManager from "./ContextMenus";
import { CONTEXT_MENU_SCREEN_PADDING, CONTEXT_MENU_WIDTH } from "./constants";
import { setContextMenu, store } from "./redux";
import { IActiveContextMenu, IContextMenuField } from "./types";
import './styles.css'

export function createContextMenu<TData>(event: MouseEvent, options: IContextMenuField<TData>[], data: TData) {
    const predictedMenuHeight = options.length * 30;
    const offsetX =
        window.innerWidth - event.clientX <
            CONTEXT_MENU_WIDTH + CONTEXT_MENU_SCREEN_PADDING
            ? CONTEXT_MENU_WIDTH * -1
            : 0;
    const offsetY =
        window.innerHeight - event.clientY < predictedMenuHeight
            ? predictedMenuHeight * -1
            : 0;

    const newMenu: IActiveContextMenu<TData> = {
        position: {
            x: event.clientX + offsetX,
            y: event.clientY + offsetY,
        },
        options: options.map(c => {
            const oldCallback = c.callback;
            c.callback = (...args) => {
                oldCallback(...args)
                store.dispatch(setContextMenu(null))
            }
            return c
        }),
        data: data
    };

    store.dispatch(setContextMenu(newMenu as IActiveContextMenu<unknown>))
}
export {
    ContextMenuManager
}