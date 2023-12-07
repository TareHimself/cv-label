import type { TypedUseSelectorHook } from "react-redux";
import { createDispatchHook, createSelectorHook } from "react-redux";
import type { AppDispatch, RootState } from "./store";
import dialogStoreContext from "./context";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = createDispatchHook(dialogStoreContext);
export const useAppSelector: TypedUseSelectorHook<RootState> = createSelectorHook(dialogStoreContext);
