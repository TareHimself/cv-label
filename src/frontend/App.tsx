import Editor from "@components/editor/Editor";
import Projects from "@components/projects/Projects";
import { fetchPlugins } from "@redux/exports";
import { useAppDispatch } from "@redux/hooks";
import { useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    console.log("FETCHING PLUGINS")
    dispatch(fetchPlugins()).then(c => console.log(c.payload));
  }, [dispatch]);

  return (
    <MemoryRouter basename="/" initialEntries={["/projects"]}>
      <Routes>
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<Editor />} />
      </Routes>
    </MemoryRouter>
  );
}
