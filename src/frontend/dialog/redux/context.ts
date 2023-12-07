import { AnyAction } from "@reduxjs/toolkit";
import { createContext } from "react";
import { ReactReduxContextValue } from "react-redux";

const dialogStoreContext = createContext<object>({});

export default dialogStoreContext as React.Context<ReactReduxContextValue<unknown, AnyAction>>