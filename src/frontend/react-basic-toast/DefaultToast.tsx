import { ToastConfigRendererPropsType } from "./types";

export default function DefaultToast({
  data }: ToastConfigRendererPropsType<string>) {
  return (
    <div className="default-toast-style">
      <h3>{data}</h3>
    </div>
  );
}
