import { Outlet, Route, Routes } from "react-router-dom";
import Home from "@/pages/Home";
import Test from "@/pages/Test";

export default function ClientRoute() {
  return (
    <Route element={<Outlet />}>
      <Route path="/*" element={<Home />} />;
      <Route path="/test" element={<Test />} />;
    </Route>
  );
}
