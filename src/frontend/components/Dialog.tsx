import React, { PropsWithChildren, useEffect, useId, useMemo, useRef } from "react";



export type DialogController = {
  id: string;
}
export function useDialog(): DialogController{
  const dialogId = useId()


  return useMemo(()=>{
    return ( { id: dialogId })
  },[dialogId])
}

export type DialogPropsType = PropsWithChildren<{
  controller: DialogController
}>;


export default function Dialog({ children, controller }: DialogPropsType) {
  const dialogId = controller.id;

  return <dialog id={dialogId}>{children}</dialog>;
}
