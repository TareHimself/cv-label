/* eslint-disable @typescript-eslint/no-empty-function */
import { domRectToBasicRect } from "@hooks/useElementRect";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { createPromise, wrap } from "@root/utils";
// import { toast } from "react-toastify"
import {
  AppSliceState,
  BasicRect,
  CvAnnotation,
  ECVModelType,
  EditorSliceState,
  EEditorMode,
  ValueOf,
} from "@types";
import { toast } from "react-hot-toast";

const initialState: EditorSliceState = {
  samples: {},
  sampleIds: [],
  sampleIndex: 0,
  activeLabeler: undefined,
  mode: EEditorMode.SELECT,
  sampleScale: 1,
  xScroll: 0,
  yScroll: 0,
  selectedAnnotationIndex: -1,
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
  isLoadingCurrentSample: false,
  isLoadingLabeler: false,
  sampleImageInfo: {
    width: 0,
    height: 0,
  },
  availableExporters: [],
  availableImporters: [],
  availableModels: [],
};

const fetchPlugins = createAsyncThunk("editor/plugins/load", async () => {
  const [importers, exporters, models] = await Promise.all([
    window.bridge.getImporters(),
    window.bridge.getExporters(),
    window.bridge.getSupportedModels(),
  ]);

  return {
    importers,
    exporters,
    models,
  };
});

const fetchSample = createAsyncThunk("editor/samples/fetch", async ({ id }: { id: string }) => {
  const sample = await window.bridge.getSample(id);

  return sample;
});

const importSamples = createAsyncThunk<
  string[],
  { id: string },
  AppSliceState
>("editor/samples/import", async ({ id }, thunk) => {
  const state = thunk.getState().projects;
  if (state.projectId) {
    return await window.bridge.importSamples(state.projectId, id);
  }
  return [];
});

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

const unloadModel = createAsyncThunk("editor/labeler/unload", async () => {
  return await window.bridge.unloadModel();
});

const autoLabel = createAsyncThunk<
  {
    samplePath: string;
    result: CvAnnotation[] | undefined;
  },
  { samplePath: string },
  AppSliceState
>("editor/labeler/auto", async ({ samplePath: sampleId }, thunk) => {

  return await toast.promise(createPromise(async () => {
    const state = thunk.getState().editor;
    const projectsState = thunk.getState().projects
    const modelType = state.activeLabeler;

    if (modelType == undefined) {
      return {
        samplePath: sampleId,
        result: undefined,
      }
    }

    const annotationsToAdd = await window.bridge.doInference(modelType, `${projectsState.projectId}/images/${sampleId}`) ?? [];


    return {
      samplePath: sampleId,
      result: annotationsToAdd.length > 0  && await window.bridge.createAnnotations(sampleId,annotationsToAdd) ? annotationsToAdd : []
    }
  }), {
    success: (d) => `Added ${d.result?.length ?? 0} annotations`,
    error: `Failed to annotate`,
    loading: `Predicting`
  })
});

const loadAllSamples = createAsyncThunk("editor/samples/load", async () => {
  return await window.bridge.getSampleIds();
});

export const EditorSlice = createSlice({
  name: "editor",
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    addLabels: (state, action: PayloadAction<CvAnnotation[]>) => {
      const current = state.samples[state.sampleIds[state.sampleIndex]];
      if (current !== undefined) {
        current.annotations.push(...action.payload);
      }
    },
    editLabel: (state, action: PayloadAction<[number, CvAnnotation]>) => {
      const current = state.samples[state.sampleIds[state.sampleIndex]];
      if (current !== undefined) {
        current.annotations[action.payload[0]] = action.payload[1];
      }
    },
    addSamples: (state, action: PayloadAction<string[]>) => {
      state.sampleIds.push(...action.payload);
    },
    setCurrentSample: (state, action: PayloadAction<number>) => {
      const targetIdx = wrap(action.payload, 0, state.sampleIds.length - 1);
      if (state.sampleIds[targetIdx] !== undefined) {
        state.sampleIndex = targetIdx;
        state.selectedAnnotationIndex = -1;
        state.isLoadingCurrentSample = true;
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
          state.selectedAnnotationIndex = -1;
          break;

        case EEditorMode.CREATE_SEGMENT:
          state.selectedAnnotationIndex = -1;
          break;

        default:
          break;
      }
    },
    setCurrentAnnotationIndex: (state, action: PayloadAction<number>) => {
      state.selectedAnnotationIndex = action.payload;
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
      state.sampleIds.push(...action.payload)
      console.log("Imported ", action.payload)
    });
    builder.addCase(loadModel.fulfilled, (state, action) => {
      state.activeLabeler = action.payload;
      state.isLoadingLabeler = false
    });
    builder.addCase(loadModel.pending, (state) => {
      state.isLoadingLabeler = true;
    });
    builder.addCase(unloadModel.fulfilled, (state, action) => {
      if (action.payload) {
        state.activeLabeler = undefined;
      }
    });

    builder.addCase(autoLabel.fulfilled, (state, action) => {
      if (action.payload.result !== undefined) {
        const sample = state.samples[action.payload.samplePath]
        if (sample) {
          sample.annotations =
            action.payload.result;
        }
      }
    });
    builder.addCase(fetchPlugins.fulfilled, (state, action) => {
      state.availableExporters = action.payload.exporters;
      state.availableImporters = action.payload.importers;
      state.availableModels = action.payload.models;
      console.log("IMPORTERS", state.availableImporters)
    });
    builder.addCase(fetchSample.fulfilled, (state, action) => {
      if (action.payload !== undefined) {
        state.samples[action.payload.id] = action.payload
      }
    });
    builder.addCase(loadAllSamples.fulfilled, (state, action) => {
      state.sampleIds.push(...action.payload)
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
  setCurrentAnnotationIndex,
  setScrollDelta,
  setLabelerContainerRect,
  onImageLoaded,
} = EditorSlice.actions;
export { importSamples, loadModel, unloadModel, autoLabel, fetchPlugins, fetchSample, loadAllSamples };

export default EditorSlice.reducer;
