import React from "react";
import { EventEmitter } from "stream";

export type ToastRenderProps = { info: IActiveToast };

export interface IActiveToast {
  toastId: string;
  duration: "promise" | number;
  render: (props: ToastRenderProps) => React.ReactNode;
}

export type ToastConfigRendererPropsType<T = unknown> = {
  props: ToastRenderProps;
  data: T;
};

export interface IToastConfig<
  RendererPropsType extends ToastConfigRendererPropsType = ToastConfigRendererPropsType
> {
  duration: IActiveToast["duration"];
  render: ((props: RendererPropsType) => React.ReactNode | string) | string;
}

export type ToastContainerProps = {
  style?: React.CSSProperties;
  fadeInTime?: number;
  fadeOutTime?: number;
  addToTop?: boolean;
  defaultToast?: ToastConfigRendererPropsType<string>;
};

export type ToastItemProps = {
  updateToasts: (value: React.SetStateAction<IActiveToast[]>) => void;
  emitter: EventEmitter;
  data: IActiveToast;
  fadeInTime: number;
  fadeOutTime: number;
};

export type IToastUpdate = Partial<Pick<IActiveToast, "duration" | "render">>;

export interface IToastPromiseRenderers<PromiseResolvedType> {
  pending: IToastConfig<ToastConfigRendererPropsType<undefined>>["render"];
  success: IToastConfig<
    ToastConfigRendererPropsType<PromiseResolvedType>
  >["render"];
  error: IToastConfig<ToastConfigRendererPropsType<unknown>>["render"];
  dismissDelay?: number;
}

declare global {
  interface Window {
    _addNewToast: (config: Pick<IActiveToast, "duration" | "render">) => string;
    _updateToast: (toastId: string, update: IToastUpdate) => void;
    _dismissToast: (toastId: string) => void;
  }
}
