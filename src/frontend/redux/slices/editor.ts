/* eslint-disable @typescript-eslint/no-empty-function */
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
// import { toast } from "react-toastify"
import { CvLabel, EditorSliceState, EEditorMode, ISample } from "@types";

const initialState: EditorSliceState = {
  samples: [
    {
      path: "C:UsersebeloMusicTarecv-labelja_one_punch_man_chapter_16_05.png",
      labels: [],
    },
  ],
  currentSampleIndex: 0,
  activeLabeler: null,
  mode: EEditorMode.SELECT,
};

const loadSamples = createAsyncThunk("editor/samples/load", async () => {});

const createLabeler = createAsyncThunk("editor/labeler/create", async () => {});

const autoLabel = createAsyncThunk("editor/labeler/auto", async () => {});

export const EditorSlice = createSlice({
  name: "editor",
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    addLabels: (state, action: PayloadAction<CvLabel[]>) => {
      const current = state.samples[state.currentSampleIndex];
      if (current !== undefined) {
        current.labels.push(...action.payload);
      }
    },
    editLabel: (state, action: PayloadAction<[number, CvLabel]>) => {
      const current = state.samples[state.currentSampleIndex];
      if (current !== undefined) {
        current.labels[action.payload[0]] = action.payload[1];
      }
    },
    addSamples: (state, action: PayloadAction<ISample[]>) => {
      state.samples.push(...action.payload);
    },
    setCurrentSample: (state, action: PayloadAction<number>) => {
      if (state.samples[action.payload] !== undefined) {
        state.currentSampleIndex = action.payload;
      }
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  // extraReducers: (builder) => {},
});

export const { addLabels, editLabel, addSamples, setCurrentSample } =
  EditorSlice.caseReducers;
export { loadSamples, createLabeler, autoLabel };

export default EditorSlice.reducer;
