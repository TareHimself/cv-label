import Editor from "@components/editor/Editor";
import Projects from "@components/projects/Projects";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createTheme, MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import { useEffect } from "react";
import { useProjectsState } from "@hooks/useProjectsState";




const theme = createTheme({
  /** Put your mantine theme override here */
});

export default function App() {

  useEffect(() => {
    useProjectsState.getState().load()
  },[])
  return (
    <MantineProvider theme={theme}>
      <MemoryRouter basename="/" initialEntries={["/projects"]}>
        <Routes>
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<Editor />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>
  );
}
