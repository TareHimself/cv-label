import React, { PropsWithChildren, useEffect, useId, useRef } from "react";

export type DialogPropsType = PropsWithChildren<{
  ref: (r: HTMLDialogElement) => void;
}>;

export default function Dialog({ children, ref }: DialogPropsType) {
  const dialogId = useRef(useId()).current;

  useEffect(() => {
    const dialog = document.getElementById(
      dialogId
    ) as HTMLDialogElement | null;
    if (dialog) {
      ref(dialog);
    }
  }, [dialogId, ref]);
  return <dialog id={dialogId}>{children}</dialog>;
}
