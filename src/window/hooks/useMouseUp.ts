import { useEffect } from "react";

export default function useMouseUp(callback: (ev: MouseEvent) => void) {
  useEffect(() => {
    window.addEventListener("mouseup", callback);

    return () => {
      window.removeEventListener("mouseup", callback);
    };
  }, [callback]);
}
