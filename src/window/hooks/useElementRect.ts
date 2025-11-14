import { BasicRect } from "@types";
import { useEffect } from "react";

export function domRectToBasicRect(rect: DOMRect): BasicRect {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export default function useElementRect<T extends HTMLElement | null>(
  getElement: () => T,
  onElementRect: (rect: BasicRect) => void,
  debugId?: string
) {
  useEffect(() => {
    const element = getElement();
    if (element) {
      let activeAimationFrame: number | undefined = undefined;

      let oldRect: BasicRect = {
        height: 0,
        width: 0,
        x: 0,
        y: 0,
      };

      const handleAnimationFrame = () => {
        activeAimationFrame = undefined;
        const newRect = domRectToBasicRect(element.getBoundingClientRect());
        if (debugId) {
          console.log(debugId, ">>", "Rect Size", newRect);
        }
        if (
          Object.values(newRect).reduce((t, c) => t + c, 0) !== 0 &&
          JSON.stringify(oldRect) !== JSON.stringify(newRect)
        ) {
          oldRect = newRect;
          onElementRect(newRect);
        }

        // if (element === document.getElementById("label-overlay"))
        //   console.log(newRect);

        setImmediate(() => {
          activeAimationFrame = requestAnimationFrame(handleAnimationFrame);
        })
      };

      handleAnimationFrame();

      //   const elementObserver = new ResizeObserver(() => {
      //     const rect = element.getBoundingClientRect();
      //     onElementRect(domRectToBasicRect(rect));
      //   });

      //   elementObserver.observe(element);

      return () => {
        if (activeAimationFrame) {
          cancelAnimationFrame(activeAimationFrame);
        }
      };
    } else {
      if (debugId) {
        console.log(debugId, ">>", "Element is not valid");
      }
    }
  }, [debugId, getElement, onElementRect]);
}
