import { createRoot } from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import { store } from "@redux/store";
import { ToastContainer } from "./react-basic-toast";

const root = document.getElementById("root");
if (root) {
  const rootNode = createRoot(root);

  rootNode.render(
    <Provider store={store}>
      <App />
      <ToastContainer
        style={{ bottom: "10px", right: "10px" }}
        fadeInTime={100}
        fadeOutTime={100}
      />
    </Provider>
  );
}
