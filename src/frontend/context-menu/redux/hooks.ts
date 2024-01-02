import type { TypedUseSelectorHook } from "react-redux";
import { createDispatchHook, createSelectorHook } from "react-redux";
import type { AppDispatch, RootState } from "./store";
import contextMenuContext from "./context";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = createDispatchHook(contextMenuContext);
export const useAppSelector: TypedUseSelectorHook<RootState> = createSelectorHook(contextMenuContext);
