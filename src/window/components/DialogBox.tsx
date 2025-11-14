import React, { PropsWithChildren } from "react";
import { IoArrowBackCircleSharp } from "react-icons/io5";

export type DialogBoxProps = PropsWithChildren<{
  onCloseRequest?: () => void;
}>;
export default function DialogBox(props: DialogBoxProps) {
  return (
    <div className="dialog-box">
      {props.onCloseRequest !== undefined && (
        <span
          style={{
            display: "flex",
            width: "100%",
          }}
        >
          <button onClick={props.onCloseRequest}>
            <IoArrowBackCircleSharp size={30} />
          </button>
        </span>
      )}
      {props.children}
    </div>
  );
}
