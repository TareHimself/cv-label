import { PropsWithChildren } from "react";

export type ValueOf<E> = E[keyof E];

export type Without<T,K extends keyof T> = T[Exclude<keyof T,K>]

export type TPartialExcept<T,Fields extends keyof T> = Partial<T> & { [K in Fields]: T[K]};

export type TUpdateWithId<T extends { id: unknown }> = TPartialExcept<T,'id'>

export const enum ELabelType {
  BOX = 0,
  SEGMENT = 1,
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

export interface IDatabaseAnnotation {
  id: string;
  type: ELabelType;
  class: number;
  points: IDatabasePoint[];
}

export interface IDatabaseImage {
  id: string;
  name: string;
  width: number;
  height: number;
  extension: string;
}

export interface IDatabaseSample {
  id: string;
  imageId: string
  annotations: IDatabaseAnnotation[];
}

// export interface IDatabaseSampleOrder {
//   id: string;
//   index: bigint;
// }

export interface IDatabaseInstance {
    close: () => void;
    getSample: (sampleId: string) => Promise<IDatabaseSample | undefined>
    getImage: (imageId: string) => Promise<IDatabaseImage | undefined>
    getSamples: () => Promise<IDatabaseSample[] | undefined>
    getImages: () => Promise<IDatabaseImage[] | undefined>
    createImage: (image: IDatabaseImage) => Promise<boolean>
    createSample: (sample: IDatabaseSample) => Promise<boolean>
    createAnnotations: (sampleId: string,annotations: IDatabaseAnnotation[]) => Promise<IDatabaseSample | undefined>
    updateAnnotations: (sampleId: string,annotations: TUpdateWithId<IDatabaseAnnotation>[]) => Promise<IDatabaseSample | undefined>
    removeAnnotations: (sampleId: string, annotations: string[]) => Promise<IDatabaseSample | undefined>
    createPoints: (sampleId: string, annotationId: string, points: IDatabasePoint[]) => Promise<IDatabaseSample | undefined>
    replacePoints: (sampleId: string, annotationId: string, points: IDatabasePoint[]) => Promise<IDatabaseSample | undefined>
    updatePoints: (sampleId: string, annotationId: string, points: TUpdateWithId<IDatabasePoint>[]) => Promise<IDatabaseSample | undefined>
    removePoints: (sampleId: string, annotationId: string, points: string[]) => Promise<IDatabaseSample | undefined>
}

export interface IDatabaseSampleList {
  id: string;
  samples: string[]
}

export interface IProject {
  id: string;
  name: string;
}

export type IMainToIoEvents = {
  importSamples: (projectId: string, importerId: string,options: PluginOptionResultMap) => Promise<string[]>;
  exportSamples: (projectId: string, importerId: string) => Promise<number>;
  getImporters: () => Promise<IPluginInfo[]>;
  getExporters: () => Promise<IPluginInfo[]>;
  createProject: (name: string) => Promise<IProject| undefined>;
  getProjects: () => Promise<IProject[]>
  getSample: (sampleId: string) => Promise<IDatabaseSample | undefined>
  getSampleIds: () => Promise<string[]>
  activateProject: (projectId: string) => Promise<boolean>
  createAnnotations: (sampleId: string, annotations: IDatabaseAnnotation[]) => Promise<IDatabaseSample | null>
  updateAnnotations: (sampleId: string, annotations: TUpdateWithId<IDatabaseAnnotation>[]) => Promise<IDatabaseSample | null>
  removeAnnotations: (sampleId: string, annotations: string[]) => Promise<IDatabaseSample | null>
  createPoints: (sampleId: string,annotationId: string, points: IDatabasePoint[]) => Promise<IDatabaseAnnotation | null>
  replacePoints: (sampleId: string,annotationId: string, points: IDatabasePoint[]) => Promise<IDatabaseAnnotation | null>
  updatePoints: (sampleId: string,annotationId: string,points: TUpdateWithId<IDatabasePoint>[]) => Promise<IDatabaseAnnotation | null>
  removePoints: (sampleId: string,annotationId: string, points: string[]) => Promise<IDatabaseAnnotation | null>
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

export type IRendererToMainEvents = {
  getPreloadPath: () => string;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  getPlatform: () => NodeJS.Platform;
  isDev: () => boolean;

  saveImage: (imageString: string) => Promise<boolean>
} & IMainToIoEvents & IMainToModelsEvents;

export type IMainToRendererEvents = {
  executeJs: () => Promise<unknown>;
};

export type LabelOverlayProps = PropsWithChildren<{
  labels: IDatabaseSample['annotations'];
  onLabelUpdated: (idx: number, label: CvAnnotation) => void;
}>;

export type CvLabelSegmentPoint = [number, number];



interface IPluginOptionResults {
  'string' : string;
  'number' : number;
  'fileSelect': string[];
  'folderSelect': string[];
}

interface IPluginOptionBase<T extends keyof IPluginOptionResults = keyof IPluginOptionResults>{
  id: string;
  displayName: string;
  type: T
}

export type PluginStringOption = IPluginOptionBase<'string'>;

export type PluginNumberOption = IPluginOptionBase<'number'>

export type PluginFolderOrFileOption = IPluginOptionBase<'fileSelect' | 'folderSelect'> & {
  multiple: boolean;
}

export type PluginOptionProps<T = unknown> = { 
  id: string
  title: string
  onSelected: (data: T) => void
}
// export type PluginOption = PluginStringOption | PluginNumberOption | PluginFolderOrFileOption;
export type PluginOption = {
  id: string
  title: string
  component: React.FC<PluginOptionProps>
  defaultValue: unknown
}

// export type PluginOptionResult<T extends keyof IPluginOptionResults = keyof IPluginOptionResults> = {
//   id: string;
//   type: T;
//   value: IPluginOptionResults[T];
// }

export type PluginOptionResultMap = { [id: string]: unknown }


export interface IPluginInfo {
  getId: () => string
  getName: () => string
  getOptions: () => PluginOption[];
}

export interface CvBoxAnnotation extends IDatabaseAnnotation {
  type: ELabelType.BOX;
}

export interface CvSegmentAnnotation extends IDatabaseAnnotation {
  type: ELabelType.SEGMENT;
}

export type CvAnnotation = CvBoxAnnotation | CvSegmentAnnotation;

export interface INewSample {
  path: string;
  annotations: CvAnnotation[];
}

export type SidePanelIds = '' | 'samples' | 'annotations';
export type AppSliceState = {
  projectId: string | undefined;
  loadedSamples: { [key: string]: IDatabaseSample | undefined };
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
  currentSidePanel: SidePanelIds
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


export type Vector2 = {
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
  interface ObjectConstructor {
    keys<T>(obj: T): Array<keyof T>;
  }
}



export {}