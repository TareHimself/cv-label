import { createRoot } from "react-dom/client";
import App from "./App";
import { Toaster } from "react-hot-toast";
import { ContextMenuManager } from "./context-menu";

const root = document.getElementById("root");

if (root) {
  const rootNode = createRoot(root);

  rootNode.render(
      <>
      <ContextMenuManager/>
        <App />
      {/* </DialogManager> */}
      <Toaster position="bottom-right" reverseOrder={false} />
      {/* <ToastContainer
        style={{ bottom: "10px", right: "10px" }}
        fadeInTime={100}
        fadeOutTime={100}
      /> */}
      </>
  );
}
