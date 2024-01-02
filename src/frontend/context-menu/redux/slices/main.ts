/* eslint-disable @typescript-eslint/no-empty-function */
import { IActiveContextMenu } from "../../types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
// import { toast } from "react-toastify"


type MainSliceState = {
  contextMenu: IActiveContextMenu | null;
}
const initialState: MainSliceState = {
  contextMenu: null
};

export const MainSlice = createSlice({
  name: "main",
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    setContextMenu: (
      state,
      action: PayloadAction<IActiveContextMenu | null>
    ) => {
      state.contextMenu = action.payload;
    }
  },
});

export const {
  setContextMenu
} = MainSlice.actions;

export default MainSlice.reducer;
