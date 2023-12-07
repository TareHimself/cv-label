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
    closeDialog: (state, action: PayloadAction<string>) => {
      const targetId = state.dialogs.findIndex(c => c.data.id === action.payload)
      if(targetId !== undefined){
        state.dialogs.splice(targetId,1)
      }
    },
  },
});

export const {
  createDialog,
  closeDialog
} = DialogSlice.actions;

export default DialogSlice.reducer;
