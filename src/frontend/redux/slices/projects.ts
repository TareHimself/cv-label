/* eslint-disable @typescript-eslint/no-empty-function */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
// import { toast } from "react-toastify"
import { ProjectsSliceState } from "@types";

const initialState: ProjectsSliceState = {
  projectId: undefined,
};

const createProject = createAsyncThunk(
  "projects/create",
  async ({ projectName }: { projectName: string }) => {
    return await window.bridge.createProject(projectName);
  }
);

export const ProjectsSlice = createSlice({
  name: "projects",
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  extraReducers: (builder) => {
    builder.addCase(createProject.fulfilled, (state, action) => {
      state.projectId = action.payload;
    });
  },
});

// export const {} = ProjectsSlice.actions;
export { createProject };

export default ProjectsSlice.reducer;
