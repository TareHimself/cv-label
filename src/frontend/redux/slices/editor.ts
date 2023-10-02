/* eslint-disable @typescript-eslint/no-empty-function */
import { toast } from "@frontend/react-basic-toast";
import { domRectToBasicRect } from "@hooks/useElementRect";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { wrap } from "@root/utils";
// import { toast } from "react-toastify"
import {
  AppSliceState,
  BasicRect,
  CvLabel,
  ECVModelType,
  EditorSliceState,
  EEditorMode,
  ISample,
  ValueOf,
} from "@types";

const initialState: EditorSliceState = {
  samples: [],
  sampleIndex: 0,
  activeLabeler: undefined,
  mode: EEditorMode.SELECT,
  sampleScale: 1,
  xScroll: 0,
  yScroll: 0,
  currentLabelIndex: -1,
  labelerContainerRect: {
    height: 0,
    width: 0,
    x: 0,
    y: 0,
  },
  labelerRect: {
    height: 0,
    width: 0,
    x: 0,
    y: 0,
  },
  editorRect: {
    height: 0,
    width: 0,
    x: 0,
    y: 0,
  },
  loadedImage: null,
  isLoadingCurrentSample: false,
  sampleImageInfo: {
    width: 0,
    height: 0,
  },
};

const importSamples = createAsyncThunk(
  "editor/samples/load",
  async ({ id }: { id: string }) => {
    return await window.bridge.importSamples(id);
  }
);

const loadModel = createAsyncThunk(
  "editor/labeler/load",
  async ({
    modelType,
    modelPath,
  }: {
    modelType: ValueOf<typeof ECVModelType>;
    modelPath: string;
  }) => {
    if (await window.bridge.loadModel(modelType, modelPath)) {
      return modelType;
    }

    return undefined;
  }
);

const autoLabel = createAsyncThunk<
  {
    index: number;
    result: CvLabel[] | undefined;
  },
  { index: number },
  AppSliceState
>("editor/labeler/auto", async ({ index }, thunk) => {
  return await toast.promise(
    async () => {
      const state = thunk.getState().editor;
      const modelType = state.activeLabeler;
      const sample = state.samples[index];
      if (!modelType) {
        return {
          index,
          result: undefined,
        };
      }

      return {
        index,
        result: await window.bridge.doInference(modelType, sample.path),
      };
    },
    {
      success: (d) => `Added ${d.data.result?.length ?? 0} annotations`,
      error: `Failed to annotoate`,
      pending: `Predicting`,
    }
  );
});

export const EditorSlice = createSlice({
  name: "editor",
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    addLabels: (state, action: PayloadAction<CvLabel[]>) => {
      const current = state.samples[state.sampleIndex];
      if (current !== undefined) {
        current.labels.push(...action.payload);
      }
    },
    editLabel: (state, action: PayloadAction<[number, CvLabel]>) => {
      const current = state.samples[state.sampleIndex];
      if (current !== undefined) {
        current.labels[action.payload[0]] = action.payload[1];
      }
    },
    addSamples: (state, action: PayloadAction<ISample[]>) => {
      state.samples.push(...action.payload);
    },
    setCurrentSample: (state, action: PayloadAction<number>) => {
      const targetIdx = wrap(action.payload, 0, state.samples.length - 1);
      if (state.samples[targetIdx] !== undefined) {
        state.sampleIndex = targetIdx;
        state.currentLabelIndex = -1;
        state.isLoadingCurrentSample = true;
        state.loadedImage = null;
      }
    },
    resetSampleScale: (state) => {
      state.sampleScale = 1;
    },
    setSampleScale: (state, action: PayloadAction<number>) => {
      const oldScale = state.sampleScale;

      state.sampleScale = Math.max(1, action.payload);

      const scaleDiff = state.sampleScale - oldScale;

      const scrollXDiff = scaleDiff * (state.editorRect.width / 2) * -1;

      const scrollYDiff = scaleDiff * (state.editorRect.width / 2) * -1;

      state.xScroll += scrollXDiff;

      state.yScroll += scrollYDiff;
    },
    setLabelerRect: (state, action: PayloadAction<BasicRect>) => {
      const actualHeight =
        action.payload.width *
        (state.sampleImageInfo.height / state.sampleImageInfo.width);
      state.labelerRect = {
        x: action.payload.x,
        width: action.payload.width,
        height: actualHeight,
        y: action.payload.y - (actualHeight - action.payload.height) / 2,
      };
    },
    setEditorRect: (state, action: PayloadAction<BasicRect>) => {
      state.editorRect = action.payload;
    },
    setLabelerContainerRect: (state, action: PayloadAction<BasicRect>) => {
      state.labelerContainerRect = action.payload;
    },
    setEditorMode: (state, action: PayloadAction<EEditorMode>) => {
      state.mode = action.payload;

      switch (state.mode) {
        case EEditorMode.SELECT:
          break;

        case EEditorMode.CREATE_BOX:
          state.currentLabelIndex = -1;
          break;

        case EEditorMode.CREATE_SEGMENT:
          state.currentLabelIndex = -1;
          break;

        default:
          break;
      }
    },
    setLabelIndex: (state, action: PayloadAction<number>) => {
      state.currentLabelIndex = action.payload;
    },
    setScrollDelta: (state, action: PayloadAction<[number, number]>) => {
      const [deltaX, deltaY] = action.payload;

      state.xScroll += deltaX;
      state.yScroll += deltaY;
    },
    onImageLoaded: (state, action: PayloadAction<HTMLImageElement>) => {
      state.sampleImageInfo = {
        width: action.payload.naturalWidth,
        height: action.payload.naturalHeight,
      };

      const newLabelerRect = domRectToBasicRect(
        action.payload.getBoundingClientRect()
      );

      const actualHeight =
        newLabelerRect.width *
        (state.sampleImageInfo.height / state.sampleImageInfo.width);

      state.labelerRect = {
        x: newLabelerRect.x,
        width: newLabelerRect.width,
        height: actualHeight,
        y: newLabelerRect.y - (actualHeight - newLabelerRect.height) / 2,
      };

      state.sampleScale = 1;
      state.xScroll = 0;
      state.yScroll = 0;

      state.isLoadingCurrentSample = false;
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  extraReducers: (builder) => {
    builder.addCase(importSamples.fulfilled, (state, action) => {
      state.samples.push(...action.payload);
    });
    builder.addCase(loadModel.fulfilled, (state, action) => {
      state.activeLabeler = action.payload;
    });
    builder.addCase(autoLabel.fulfilled, (state, action) => {
      if (action.payload.result) {
        state.samples[action.payload.index].labels = action.payload.result;
      }
    });
  },
});

export const {
  addLabels,
  editLabel,
  addSamples,
  setCurrentSample,
  setSampleScale,
  setLabelerRect,
  setEditorMode,
  setEditorRect,
  setLabelIndex,
  setScrollDelta,
  setLabelerContainerRect,
  onImageLoaded,
} = EditorSlice.actions;
export { importSamples, loadModel, autoLabel };

export default EditorSlice.reducer;
