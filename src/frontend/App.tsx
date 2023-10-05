import Editor from "@components/editor/Editor";
import { fetchPlugins } from "@redux/exports";
import { useAppDispatch } from "@redux/hooks";
import { useEffect } from "react";

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchPlugins());
  }, [dispatch]);

  return <Editor />;
}
