import { AnyAction } from "@reduxjs/toolkit";
import { createContext } from "react";
import { ReactReduxContextValue } from "react-redux";

const contextMenuContext = createContext<object>({});

export default contextMenuContext as React.Context<ReactReduxContextValue<unknown, AnyAction>>