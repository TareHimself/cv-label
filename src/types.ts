export type ValueOf<E> = E[keyof E]

export const enum ECVModelType {
    Yolov8Detect = 'yolov8-detect',
    Yolov8Seg = 'yolov8-seg',
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
    [ECVModelType.Yolov8Seg]:{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        class: number;
        confidence: number;
        mask: [number,number][]
    }[]
}

export type InferenceResult<T extends ValueOf<typeof ECVModelType> = ValueOf<typeof ECVModelType>> = ICVModelInferenceResults[T]


export type IRendererToMainEvents = {
    getPreloadPath: () => string;
    windowMinimize: () => void;
    windowMaximize: () => void;
    windowClose: () => void;
    getPlatform: () => NodeJS.Platform;
    isDev: () => boolean;
    selectModel: () => Promise<string | undefined>;
    loadModel: (modelType: ValueOf<typeof ECVModelType>,modelPath: string) => Promise<boolean>;
    getModel: () => ECVModelType
    doInference: <T extends ValueOf<typeof ECVModelType> = ValueOf<typeof ECVModelType>>(modelType: T,imagePath: string) => Promise<InferenceResult<T> | undefined>;
};

export type IMainToRendererEvents = {
    executeJs: () => Promise<unknown>
}

export type LabelOverlayProps = {
    labels: CvLabel[]
    image: {
        drawWidth: number;
        naturalWidth: number;
        drawHeight: number;
        naturalHeight: number;
    },
    onLabelUpdated: (idx: number,label: CvLabel) => void
}

export const enum ELabelType {
    BOX = 'box',
    SEGMENT = 'segment'
}

export type CvLabelSegmentPoint = [number,number];

type CvLabelBase = {
    classIndex: number;
    type: ELabelType
}

export type CvBoxLabel = CvLabelBase & {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: ELabelType.BOX;
}

export type CvSegmentLabel = CvLabelBase & {
    points: CvLabelSegmentPoint[];
    type: ELabelType.SEGMENT;
}

export type CvLabel = CvBoxLabel | CvSegmentLabel


export interface ISample {
    samplePath: string;
    labels: CvLabel[]
}