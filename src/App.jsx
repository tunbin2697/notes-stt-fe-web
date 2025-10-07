import { Routes, Route } from "react-router-dom";
import ClientRoute from "@/routes/ClientRoute";

function App() {
  return <Routes>{ClientRoute()}</Routes>;
}

export default App;
