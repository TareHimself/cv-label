import { createRoot } from "react-dom/client";
import App from './App';

const root = document.getElementById('root')
if(root){
    const rootNode = createRoot(root)

    rootNode.render(<App />)
}
