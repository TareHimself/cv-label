import { PropsWithChildren } from "react";

export type ValueOf<E> = E[keyof E];

export const enum ECVModelType {
  Yolov8Detect,
  Yolov8Seg,
}

export const enum ELabelType {
  BOX,
  SEGMENT,
}

export const enum EEditorMode {
  SELECT,
  CREATE_BOX,
  CREATE_SEGMENT,
}

export type BasicRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export interface IDatabasePoint {
  id: string;
  x: number;
  y: number;
}

export interface IDatabaseAnnotation<T = string[]> {
  id: string;
  type: ELabelType;
  class: number;
  points: T;
}

export interface IDatabaseSample<T = string[]> {
  id: string;
  annotations: T;
  createdAt: string;
}

export type ActiveDatabaseSample = IDatabaseSample<IDatabaseAnnotation<IDatabasePoint[]>[]>

export type IRendererToMainEvents = {
  getPreloadPath: () => string;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  getPlatform: () => NodeJS.Platform;
  isDev: () => boolean;
  importSamples: (projectId: string, importerId: string) => Promise<string[]>;
  getImporters: () => Promise<IPluginInfo[]>;
  getExporters: () => Promise<IPluginInfo[]>;
  createProject: (name: string) => Promise<string | undefined>;
  getSample: (sampleId: string) => Promise<ActiveDatabaseSample | undefined>
  getSampleIds: () => Promise<string[]>
  activateProject: (projectId: string) => Promise<boolean>
  createAnnotations: (sampleId: string, annotations: IDatabaseAnnotation<IDatabasePoint[]>[]) => Promise<boolean>
  removeAnnotations: (sampleId: string, annotations: string[]) => Promise<boolean>
  createPoints: (annotationId: string, points: string[]) => Promise<boolean>
  updatePoints: (points: IDatabasePoint[]) => Promise<boolean>
  removePoints: (sampleId:string,annotationId: string, points: string[]) => Promise<boolean>
  saveImage: (imageString: string) => Promise<boolean>


  selectModel: () => Promise<string | undefined>;
  loadModel: (
    modelType: ValueOf<typeof ECVModelType>,
    modelPath: string
  ) => Promise<boolean>;
  unloadModel: () => Promise<boolean>;
  getModel: () => ECVModelType;
  doInference: (
    modelType: ValueOf<typeof ECVModelType>,
    imagePath: string
  ) => Promise<CvAnnotation[] | undefined>;
  getSupportedModels: () => Promise<IPluginInfo[]>;
};

export type IMainToModelsBackendEvents = {
  getPreloadPath: () => string;
  selectModel: () => Promise<string | undefined>;
  loadModel: (
    modelType: ValueOf<typeof ECVModelType>,
    modelPath: string
  ) => Promise<boolean>;
  unloadModel: () => Promise<boolean>;
  getModel: () => ECVModelType;
  doInference: (
    modelType: ValueOf<typeof ECVModelType>,
    imagePath: string
  ) => Promise<CvAnnotation[] | undefined>;
  getSupportedModels: () => Promise<IPluginInfo[]>;
};

export type IMainToRendererEvents = {
  executeJs: () => Promise<unknown>;
};

export type LabelOverlayProps = PropsWithChildren<{
  labels: ActiveDatabaseSample['annotations'];
  onLabelUpdated: (idx: number, label: CvAnnotation) => void;
}>;

export type CvLabelSegmentPoint = [number, number];

interface IPluginInfo {
  id: string;
  displayName: string;
}

export interface CvBoxAnnotation extends IDatabaseAnnotation<IDatabasePoint[]> {
  type: ELabelType.BOX;
}

export interface CvSegmentAnnotation extends IDatabaseAnnotation<IDatabasePoint[]> {
  type: ELabelType.SEGMENT;
}

export type CvAnnotation = CvBoxAnnotation | CvSegmentAnnotation;

export interface INewSample {
  path: string;
  annotations: CvAnnotation[];
}

export type EditorSliceState = {
  samples: { [key: string]: ActiveDatabaseSample | undefined };
  sampleIds: string[];
  sampleIndex: number;
  selectedAnnotationIndex: number;
  activeLabeler?: ValueOf<typeof ECVModelType>;
  mode: EEditorMode;
  sampleScale: number;
  xScroll: number;
  yScroll: number;
  labelerContainerRect: BasicRect;
  labelerRect: BasicRect;
  editorRect: BasicRect;
  isLoadingCurrentSample: boolean;
  isLoadingLabeler: boolean;
  sampleImageInfo: {
    width: number;
    height: number;
  };
  availableModels: IPluginInfo[];
  availableExporters: IPluginInfo[];
  availableImporters: IPluginInfo[];
};

export type ProjectsSliceState = {
  projectId: string | undefined;
};

export type AppSliceState = {
  state: {
    editor: EditorSliceState;
    projects: ProjectsSliceState;
  };
};

export interface IImporterInfo {
  name: string;
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncReturnType<T extends (...args: any) => Promise<any>> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (...args: any) => Promise<infer R> ? R : any;


export type Vector2D = {
  x: number;
  y: number;
}
