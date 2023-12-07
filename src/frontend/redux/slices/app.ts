/* eslint-disable @typescript-eslint/no-empty-function */
import { domRectToBasicRect } from "@hooks/useElementRect";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { createPromise, wrap } from "@root/utils";
// import { toast } from "react-toastify"
import {
  AppReduxState,
  BasicRect,
  CvAnnotation,
  AppSliceState,
  EEditorMode,
  IDatabasePoint,
} from "@types";
import { toast } from "react-hot-toast";

const initialState: AppSliceState = {
  projectId: undefined,
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

const createProject = createAsyncThunk(
  "projects/create",
  async ({ projectName }: { projectName: string }) => {
    return await window.bridge.createProject(projectName);
  }
);

const activateProject = createAsyncThunk(
  "projects/activate",
  async ({ projectId }: { projectId: string }) => {
    if (await window.bridge.activateProject(projectId)) {
      return projectId;
    }

    return undefined;
  }
);

const fetchPlugins = createAsyncThunk("app/plugins/load", async () => {
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

const fetchSample = createAsyncThunk("app/samples/fetch", async ({ id }: { id: string }) => {
  const sample = await window.bridge.getSample(id);

  return sample;
});

const importSamples = createAsyncThunk<
  string[],
  { id: string },
  AppReduxState
>("app/samples/import", async ({ id }, thunk) => {
  const state = thunk.getState().app;
  if (state.projectId) {
    return await window.bridge.importSamples(state.projectId, id);
  }
  return [];
});

const loadModel = createAsyncThunk(
  "app/labeler/load",
  async ({
    modelId
  }: {
    modelId: string
  }) => {
    try {
      return await toast.promise(createPromise(async () => {
        if (await window.bridge.loadModel(modelId)) {
          return modelId;
        }

        throw new Error("Failed to load model")
      }), {
        success: `Loaded Model`,
        error: (e) => e instanceof Error ? e.message : "Unknown Error Loading Model",
        loading: `Loading Model`
      })
    } catch (error) {
      return undefined;
    }
  }
);

const unloadModel = createAsyncThunk("app/labeler/unload", async () => {
  return await window.bridge.unloadModel();
});

const autoLabel = createAsyncThunk<
  {
    samplePath: string;
    result: CvAnnotation[] | undefined;
  },
  { samplePath: string },
  AppReduxState
>("app/labeler/auto", async ({ samplePath: sampleId }, thunk) => {

  return await toast.promise(createPromise(async () => {
    const state = thunk.getState().app;
    const modelType = state.activeLabeler;

    if (modelType == undefined) {
      return {
        samplePath: sampleId,
        result: undefined,
      }
    }

    const annotationsToAdd = await window.bridge.doInference(`${state.projectId}/images/${sampleId}`) ?? [];


    return {
      samplePath: sampleId,
      result: annotationsToAdd.length > 0 && await window.bridge.createAnnotations(sampleId, annotationsToAdd) ? annotationsToAdd : []
    }
  }), {
    success: (d) => `Added ${d.result?.length ?? 0}  annotations`,
    error: `Failed to annotate`,
    loading: `Predicting`
  })
});

const loadAllSamples = createAsyncThunk("app/samples/load", async () => {
  return await window.bridge.getSampleIds();
});


const updatePoints = createAsyncThunk("app/samples/annotations/points", async ({ sampleId, annotationIndex, points }: { sampleId: string; annotationIndex: number; points: IDatabasePoint[] }) => {
  try {
    if (await window.bridge.updatePoints(points)) {
      return {
        sampleId,
        annotationIndex,
        points: points
      };
    }
  } catch (error) {
    console.error(error)
  }
  return {
    sampleId,
    annotationIndex,
    points: []
  };
});




export const EditorSlice = createSlice({
  name: "app",
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
    builder.addCase(updatePoints.fulfilled, (state, action) => {
      const annotation = state.samples[action.payload.sampleId]?.annotations[action.payload.annotationIndex];
      if (annotation !== undefined) {
        action.payload.points.forEach((c) => {
          const point = annotation.points.find(d => d.id === c.id)
          if (point !== undefined) {
            point.x = c.x;
            point.y = c.y;
          }
        })
      }
    });
    builder.addCase(createProject.fulfilled, (state, action) => {
      state.projectId = action.payload;
    });
    builder.addCase(activateProject.fulfilled, (state, action) => {
      state.projectId = action.payload;
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
export { importSamples, loadModel, unloadModel, autoLabel, fetchPlugins, fetchSample, loadAllSamples, updatePoints, createProject, activateProject };

export default EditorSlice.reducer;
