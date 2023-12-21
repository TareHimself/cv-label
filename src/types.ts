import { PropsWithChildren } from "react";

export type ValueOf<E> = E[keyof E];

export type Without<T,K> = T[Exclude<keyof T,K>]

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

export interface IDatabaseSampleOrder {
  id: string;
  index: bigint;
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
    modelId: string
  ) => Promise<boolean>;
  unloadModel: () => Promise<boolean>;
  doInference: (
    imagePath: string
  ) => Promise<CvAnnotation[] | undefined>;
  getSupportedModels: () => Promise<IPluginInfo[]>;
};

export type IMainToModelsEvents = {
  getPreloadPath: () => string;
  selectModel: () => Promise<string | undefined>;
  loadModel: (
    modelId: string
  ) => Promise<boolean>;
  unloadModel: () => Promise<boolean>;
  doInference: (
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

export interface IPluginInfo {
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

export type AppSliceState = {
  projectId: string | undefined;
  loadedSamples: { [key: string]: ActiveDatabaseSample | undefined };
  sampleIds: string[];
  samplesPendingAutoLabel: string[];
  sampleIndex: number;
  selectedAnnotationIndex: number;
  activeLabeler?: string;
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


export type AppReduxState = {
  state: {
    app: AppSliceState;
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

interface ITypedRequires{
  fs: typeof import('fs')
  sharp: typeof import('sharp')
  uuid: typeof import('uuid')
  path: typeof import('node:path')
}

declare global {
  const __non_webpack_require__: <K extends keyof ITypedRequires>(id: K) => ITypedRequires[K]
}



export {}