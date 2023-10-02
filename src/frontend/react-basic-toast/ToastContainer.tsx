import "./styles.css";
import ToastItem from "./ToastItem";
import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContainerProps, IActiveToast, IToastUpdate } from "./types";
import { EventEmitter } from "events";

// () => {
//   return (
//     <div style={{ width: 200, height: 100, display: "flex", backgroundColor: "grey", borderRadius: 10 }}>
//       <h3>{"This is a Test toast with id " + toastId}</h3>
//     </div>
//   );
// }

export default function ToastContainer(props: ToastContainerProps) {
  const toastsCreated = useRef(0);
  const emitter = useRef(new EventEmitter());

  const fadeInTime = useMemo(() => props.fadeInTime ?? 500, [props.fadeInTime]);
  const fadeOutTime = useMemo(
    () => props.fadeOutTime ?? 500,
    [props.fadeOutTime]
  );

  const [activeToasts, setActiveToasts] = useState<IActiveToast[]>([]);

  window._addNewToast = useCallback(
    (config: Pick<IActiveToast, "duration" | "render">) => {
      const toastId = `${toastsCreated.current++}`;
      setActiveToasts((b) => {
        if (props.addToTop) {
          b.push({
            toastId: toastId,
            duration: config.duration,
            render: config.render,
          });
        } else {
          b.unshift({
            toastId: toastId,
            duration: config.duration,
            render: config.render,
          });
        }
        return [...b];
      });
      return toastId;
    },
    [props.addToTop]
  );

  window._dismissToast = useCallback((toastId: string) => {
    emitter.current.emit(`${toastId}-dismiss`);
  }, []);

  window._updateToast = useCallback((toastId: string, update: IToastUpdate) => {
    setActiveToasts((b) => {
      const targetIndex = b.findIndex((a) => a.toastId === toastId);
      if (targetIndex === -1) {
        return b;
      }

      const target = b[targetIndex];
      if (!target) {
        return b;
      }

      if (update.duration !== undefined) target.duration = update.duration;

      if (update.render !== undefined) target.render = update.render;

      b[targetIndex] = { ...target };

      return [...b];
    });
  }, []);

  return (
    <div
      className="react-basic-toast"
      style={
        {
          "--fade-in-time": fadeInTime.toString(),
          "--fade-out-time": fadeOutTime.toString(),
        } as React.CSSProperties
      }
    >
      <div className="toast-container" style={props.style}>
        {activeToasts.map((a) => (
          <ToastItem
            key={a.toastId}
            data={a}
            updateToasts={setActiveToasts}
            emitter={emitter.current}
            fadeInTime={fadeInTime}
            fadeOutTime={fadeOutTime}
          />
        ))}
      </div>
    </div>
  );
}
