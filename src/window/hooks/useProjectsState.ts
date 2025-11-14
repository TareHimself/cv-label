/* eslint-disable @typescript-eslint/no-unused-vars */
import { createProject, getProjects } from '@window/native/project';
import { IProject} from '@types';
import { create } from 'zustand'


export type ProjectsState = {
  projects: IProject[];
};

export type ProjectsActions = {
  load: () => void
  create: (projectName: string) => Promise<string | undefined>
};
export const useProjectsState = create<ProjectsState & ProjectsActions>((set) => ({
  projects: [],
  load: async () => {
    const projects = await getProjects()
    set(() => ({ projects }))
  },
  create: async (projectName: string) => {
    const project = await createProject(projectName)
    if(project !== undefined){
      set((state) => ({ projects: [project,...state.projects]}))
      return project.id;
    } 
    return undefined;
   }
}))