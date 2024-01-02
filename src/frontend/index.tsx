import { createRoot } from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import { store } from "@redux/store";
import { Toaster } from "react-hot-toast";
import DialogManager from "./dialog";
import { ContextMenuManager } from "./context-menu";

const root = document.getElementById("root");

if (root) {
  const rootNode = createRoot(root);

  rootNode.render(
    <Provider store={store}>
      <DialogManager
        defaultStyle={{
          display: "flex",
          padding: 0,
          border: 0,
          background: "transparent"
        }}
      />
      <ContextMenuManager/>
        <App />
      {/* </DialogManager> */}
      <Toaster position="bottom-right" reverseOrder={false} />
      {/* <ToastContainer
        style={{ bottom: "10px", right: "10px" }}
        fadeInTime={100}
        fadeOutTime={100}
      /> */}
    </Provider>
  );
}
