import { ComputerVisionLabeler } from "@frontend/cv/labelers";
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

export interface ICVModelInferenceResults {
  [ECVModelType.Yolov8Detect]: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    class: number;
    confidence: number;
  }[];
  [ECVModelType.Yolov8Seg]: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    class: number;
    confidence: number;
    mask: [number, number][];
  }[];
}

export type BasicRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type InferenceResult<
  T extends ValueOf<typeof ECVModelType> = ValueOf<typeof ECVModelType>
> = ICVModelInferenceResults[T];

export type IRendererToMainEvents = {
  getPreloadPath: () => string;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  getPlatform: () => NodeJS.Platform;
  isDev: () => boolean;
  selectModel: () => Promise<string | undefined>;
  loadModel: (
    modelType: ValueOf<typeof ECVModelType>,
    modelPath: string
  ) => Promise<boolean>;
  getModel: () => ECVModelType;
  doInference: <
    T extends ValueOf<typeof ECVModelType> = ValueOf<typeof ECVModelType>
  >(
    modelType: T,
    imagePath: string
  ) => Promise<InferenceResult<T> | undefined>;
  importSamples: (id: string) => Promise<ISample[]>;
};

export type IMainToRendererEvents = {
  executeJs: () => Promise<unknown>;
};

export type LabelOverlayProps = PropsWithChildren<{
  labels: CvLabel[];
  onLabelUpdated: (idx: number, label: CvLabel) => void;
}>;

export type CvLabelSegmentPoint = [number, number];

interface CvLabelBase {
  classIndex: number;
  type: ELabelType;
}

export interface CvBoxLabel extends CvLabelBase {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: ELabelType.BOX;
}

export interface CvSegmentLabel extends CvLabelBase {
  points: CvLabelSegmentPoint[];
  type: ELabelType.SEGMENT;
}

export type CvLabel = CvBoxLabel | CvSegmentLabel;

export interface ISample {
  path: string;
  labels: CvLabel[];
}

export type EditorSliceState = {
  samples: ISample[];
  sampleIndex: number;
  currentLabelIndex: number;
  activeLabeler: ComputerVisionLabeler<ECVModelType> | null;
  mode: EEditorMode;
  sampleScale: number;
  xScroll: number;
  yScroll: number;
  labelerContainerRect: BasicRect;
  labelerRect: BasicRect;
  editorRect: BasicRect;
  loadedImage: HTMLImageElement | null;
  isLoadingCurrentSample: boolean;
  sampleImageInfo: {
    width: number;
    height: number;
  };
};

export type AppSliceState = {
  state: {
    editor: EditorSliceState;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncReturnType<T extends (...args: any) => Promise<any>> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (...args: any) => Promise<infer R> ? R : any;
