import { LocalDataStore } from '@renderer/data/LocalDataStore'
import { IDataStore } from '@shared/types'
import { create } from 'zustand'

type AppStoreState = {
  store: IDataStore
  // projects: IProject[]
  // tasks: ITask[]
  // samples: ISample[]
  // activeProject: IProject | null
  // activeTask: ITask | null
}

type AppStoreActions = object

export const useAppStore = create<AppStoreState & AppStoreActions>(() => {
  return {
    store: new LocalDataStore()
    // projects: [],
    // tasks: [],
    // samples: [],
    // activeProject: null,
    // activeTask: null,
    // loadProjects: async () => {
    //   const { store } = get()
    //   const projects = await store.getProjects()
    //   set({ projects: projects })
    // },
    // createProject: async (name, labels) => {
    //   const { store, projects } = get()
    //   const newProject = await store.createProject(makeUUID(), name, labels)

    //   set({ projects: [...projects, newProject] })
    // },
    // openProject: async (project) => {
    //   const { store } = get()

    //   const tasks = await store.getTasks(project.id)

    //   set({ tasks, activeProject: project, activeTask: null, samples: [] })

    //   await navigateToProject(project.id)
    // },
    // createTask: async (name, files) => {
    //   const { store, activeProject } = get()
    //   if (activeProject === null) throw new Error('There is no active project')

    //   const base64Data = await Promise.all(files.map((c) => fileToBase64(c)))
    //   const newSamples = files.map<INewSample>((c, idx) => {
    //     return {
    //       id: makeUUID(),
    //       name: normalizeFilename(c.name),
    //       base64Image: base64Data[idx],
    //       split: 'train',
    //       annotations: [],
    //       createdAt: new Date().toISOString()
    //     }
    //   })

    //   const task = await store.createTask(activeProject.id, {
    //     id: makeUUID(),
    //     name: name
    //   })

    //   const samples = await store.createSamples(task.id, newSamples)

    //   console.log(samples)

    //   set((s) => ({ tasks: [...s.tasks, task] }))
    // },
    // openTask: async (task) => {
    //   const { store, activeProject } = get()

    //   if (activeProject === null) throw new Error('There is no active project')

    //   const samples = await store.getSamples(task.id)

    //   set({ activeTask: task, samples: samples })

    //   await navigateToTask(activeProject.id, task.id)
    // },
    // loadSamples: async (task) => {
    //   const { store } = get()

    //   const tasks = await store.getTasks(task.id)

    //   set({ tasks })
    // }
  }
})
