import { BasicRect, EEditorMode, IDatabaseAnnotation, IDatabasePoint, IDatabaseSample, PluginOptionResultMap, SidePanelIds, TUpdateWithId, Vector2 } from '@types';
import { create } from 'zustand'
import { activateProject, IActiveProject } from '@window/native/project';
import { SampleImporter } from '@window/native/importers/SampleImporter';
import toast from 'react-hot-toast';

const EmptyRect: BasicRect = { x: 0, y: 0, width: 0, height: 0 }
export type EditorState = {
  project: IActiveProject | undefined;
  isLoadingSample: boolean
  sampleIds: string[]
  selectedSampleIndex: number
  samples: Map<string, IDatabaseSample>;
  isLoadingCurrentSample: boolean
  selectedAnnotationIndex: number,
  mode: EEditorMode;
  scale: number;
  panX: number;
  panY: number;
  imageDisplayedRect: BasicRect;
  imageSize: {
    width: number
    height: number
  };
  editorRect: BasicRect;
  sidePanelId: SidePanelIds
};

export type EditorActions = {
  setPan: (x: number, y: number) => void
  onPan: (dx: number, dy: number) => void
  setImageDisplayedRect: (rect: BasicRect) => void
  setEditorRect: (rect: BasicRect) => void
  onImageLoaded: (image: HTMLImageElement) => void
  activateProject: (projectId: string) => Promise<boolean>
  loadSample: (sampleId: string) => Promise<void>
  setEditorMode: (mode: EEditorMode) => void
  setSidePanel: (id: SidePanelIds) => void
  setScale: (newScale: number) => void
  setSelectedSampleIndex: (index: number) => void
  setSelectedAnnotationIndex: (index: number) => void
  createAnnotations: (sampleId: string, annotations: IDatabaseAnnotation[]) => Promise<boolean>
  updateAnnotations: (sampleId: string, annotations: TUpdateWithId<IDatabaseAnnotation>[]) => Promise<boolean>
  removeAnnotations: (sampleId: string, annotationIds: string[]) => Promise<boolean>
  createPoints: (sampleId: string, annotationId: string, points: IDatabasePoint[]) => Promise<boolean>
  updatePoints: (sampleId: string, annotationId: string, points: TUpdateWithId<IDatabasePoint>[]) => Promise<boolean>
  replacePoints: (sampleId: string, annotationId: string, points: IDatabasePoint[]) => Promise<boolean>
  removePoints: (sampleId: string, annotationId: string, pointIds: string[]) => Promise<boolean>
  importSamples: (importer: SampleImporter, options: PluginOptionResultMap) => Promise<void>
  reloadSamples: () => Promise<void>
}

export const useEditorState = create<EditorState & EditorActions>((set, get) => ({
  project: undefined,
  isLoadingSample: false,
  sampleIds: [],
  selectedSampleIndex: 0,
  selectedAnnotationIndex: -1,
  samples: new Map,
  isLoadingCurrentSample: false,
  mode: EEditorMode.SELECT,
  scale: 1,
  panX: 0,
  panY: 0,
  labelerContainerRect: { ...EmptyRect },
  imageDisplayedRect: { ...EmptyRect },
  imageSize: { width: 0, height: 0 },
  editorRect: { ...EmptyRect },
  sidePanelId: 'annotations',
  setPan: (x: number, y: number) => set(() => ({ panX: x, panY: y })),
  onPan: (dx: number, dy: number) => set((s) => ({ panX: s.panX + dx, panY: s.panY + dy })),
  setImageDisplayedRect: (rect) => {
    set(() => ({ imageDisplayedRect: rect }))
  },
  setEditorRect: (rect: BasicRect) => set(() => ({ editorRect: rect })),
  onImageLoaded: (image) => set(() => {
    return {
      imageSize: {
        width: image.naturalWidth,
        height: image.naturalHeight
      },
      scale: 1,
      panX: 0,
      panY: 0,
      isLoadingCurrentSample: false,
    }
  }),
  activateProject: async (projectId) => {
    return await toast.promise(async () => {
      const project = await activateProject(projectId)
      set({ project: project })
      get().reloadSamples()
      return true
    }, {
      loading: "Loading project",
      success: "Project loaded",
      error: "Failed to activate project"
    }).catch((c) => {
      console.error(c)
      return false
    })
  },
  loadSample: async (sampleId) => {
    //
  },
  setEditorMode: (mode) => set(() => ({ mode })),
  setSidePanel: (id) => set(() => ({ sidePanelId: id })),
  setScale: (scale) => set(() => ({ scale })),
  setSelectedSampleIndex: (index) => {
    const samplesCount = get().sampleIds.length
    const newIndex = ((index % samplesCount) + samplesCount) % samplesCount;
    set(() => ({ selectedSampleIndex: newIndex, selectedAnnotationIndex: -1 }))
  },
  setSelectedAnnotationIndex: (index) => set(() => ({ selectedAnnotationIndex: index })),
  createAnnotations: async (sampleId, annotations) => {
    const project = get().project

    if (project === undefined) return false

    const samples = get().samples

    const result = await project.db.createAnnotations(sampleId, annotations)

    if (result === undefined) return false

    samples.set(result.id, result)

    set({ samples })
    return true
  },
  updateAnnotations: async (sampleId, annotations) => {
    const project = get().project

    if (project === undefined) return false

    const samples = get().samples

    const result = await project.db.updateAnnotations(sampleId, annotations)

    if (result === undefined) return false

    samples.set(result.id, result)

    set({ samples })
    return true
  },
  removeAnnotations: async (sampleId, annotationIds) => {
    const project = get().project

    if (project === undefined) return false

    const samples = get().samples

    const result = await project.db.removeAnnotations(sampleId, annotationIds)

    if (result === undefined) return false

    samples.set(result.id, result)

    set({ samples })
    return true
  },
  createPoints: async (sampleId, annotationId, points) => {
    const project = get().project

    if (project === undefined) return false

    const samples = get().samples

    const result = await project.db.createPoints(sampleId, annotationId, points)

    if (result === undefined) return false

    samples.set(result.id, result)

    set({ samples })
    return true
  },
  updatePoints: async (sampleId, annotationId, points) => {
    const project = get().project

    if (project === undefined) return false

    const samples = get().samples

    const result = await project.db.updatePoints(sampleId, annotationId, points)

    if (result === undefined) return false

    samples.set(result.id, result)

    set({ samples })
    return true
  },
  replacePoints: async (sampleId, annotationId, points) => {
    const project = get().project

    if (project === undefined) return false

    const samples = get().samples

    const result = await project.db.replacePoints(sampleId, annotationId, points)

    if (result === undefined) return false

    samples.set(result.id, result)

    set({ samples })
    return true
  },
  removePoints: async (sampleId, annotationId, pointIds) => {
    const project = get().project

    if (project === undefined) return false

    const samples = get().samples

    const result = await project.db.removePoints(sampleId, annotationId, pointIds)

    if (result === undefined) return false

    samples.set(result.id, result)

    set({ samples })
    return true
  },
  importSamples: async (plugin, options) => {
    const project = get().project;
    if (project === undefined) return

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await plugin.importIntoProject(project, options, (_, __) => { })

    await get().reloadSamples()
  },
  reloadSamples: async () => {
    const project = get().project;
    if (project === undefined) return

    const samples = await project.db.getSamples()
    if (samples === undefined) return

    const samplesMap = get().samples
    const ids: string[] = []
    for (const sample of samples) {
      samplesMap.set(sample.id, sample)
      ids.push(sample.id)
    }

    let selectedSampleIndex = get().selectedSampleIndex
    if (selectedSampleIndex == -1 && ids.length > 0) {
      selectedSampleIndex = 0
    }
    set({ sampleIds: ids, samples: samplesMap, selectedSampleIndex })
  }
}))