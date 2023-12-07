/* eslint-disable @typescript-eslint/no-empty-function */
import { IActiveDialog } from "../../types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
// import { toast } from "react-toastify"


type DialogSliceState = {
  dialogs: IActiveDialog[]
}
const initialState: DialogSliceState = {
  dialogs: []
};

export const DialogSlice = createSlice({
  name: "dialog",
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    createDialog: (state, action: PayloadAction<IActiveDialog>) => {
      state.dialogs.push(action.payload);
    },
  },
});

export const {
  createDialog
} = DialogSlice.actions;

export default DialogSlice.reducer;
