import { createContext } from "react";
import { ToastConfigRendererPropsType } from "./types";
export const ReactBasicToastContext = createContext<{
  defaultToast?: ToastConfigRendererPropsType<string>;
}>({});
