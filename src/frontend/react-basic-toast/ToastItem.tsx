import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { ToastItemProps } from "./types";

export default function ToastItem({
  updateToasts,
  data,
  emitter,
  fadeInTime,
  fadeOutTime,
}: ToastItemProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const dismissingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDismiss = useCallback(() => {
    if (isDismissing) {
      return;
    }

    setIsDismissing(true);
  }, [isDismissing]);

  useEffect(() => {
    if (typeof data.duration === "number" && durationTimeout.current === null) {
      durationTimeout.current = setTimeout(() => {
        startDismiss();
      }, fadeInTime + data.duration);
    }
  }, [data.duration, fadeInTime, startDismiss]);

  useEffect(() => {
    emitter.on(`${data.toastId}-dismiss`, startDismiss);

    return () => {
      emitter.off(`${data.toastId}-dismiss`, startDismiss);
    };
  }, [data.toastId, emitter, startDismiss]);

  useEffect(() => {
    if (isDismissing && dismissingTimeout.current === null) {
      dismissingTimeout.current = setTimeout(() => {
        updateToasts((t) => {
          t.splice(
            t.findIndex((b) => b.toastId === data.toastId),
            1
          );
          return [...t];
        });
      }, fadeOutTime + 1);
    }
  }, [data.toastId, fadeOutTime, isDismissing, updateToasts]);

  const RenderedComponent = useMemo(() => data.render({ info: data }), [data]);

  return (
    <div className={`toast-item ${isDismissing ? "hide" : "show"}`}>
      {RenderedComponent}
    </div>
  );
}
