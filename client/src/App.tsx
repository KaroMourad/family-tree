import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { TreeAccessBoundary } from "./tree/TreeAccessBoundary";
import { TreeList } from "./pages/TreeList";
import { TreeChooser } from "./pages/TreeChooser";
import { ListView } from "./pages/ListView";
import { ChartView } from "./pages/ChartView";
import { IllustratedView } from "./pages/IllustratedView";
import { CompactView } from "./pages/CompactView";
import { Editor } from "./pages/Editor";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<RequireAuth><TreeList /></RequireAuth>} />
      <Route
        path="/tree/:treeId"
        element={
          <RequireAuth>
            <TreeAccessBoundary>
              <TreeChooser />
            </TreeAccessBoundary>
          </RequireAuth>
        }
      />
      <Route
        path="/tree/:treeId/list"
        element={
          <RequireAuth>
            <TreeAccessBoundary>
              <ListView />
            </TreeAccessBoundary>
          </RequireAuth>
        }
      />
      <Route
        path="/tree/:treeId/chart"
        element={
          <RequireAuth>
            <TreeAccessBoundary>
              <ChartView />
            </TreeAccessBoundary>
          </RequireAuth>
        }
      />
      <Route
        path="/tree/:treeId/illustrated"
        element={
          <RequireAuth>
            <TreeAccessBoundary>
              <IllustratedView />
            </TreeAccessBoundary>
          </RequireAuth>
        }
      />
      <Route
        path="/tree/:treeId/compact"
        element={
          <RequireAuth>
            <TreeAccessBoundary>
              <CompactView />
            </TreeAccessBoundary>
          </RequireAuth>
        }
      />
      <Route
        path="/tree/:treeId/editor"
        element={
          <RequireAuth>
            <TreeAccessBoundary>
              <Editor />
            </TreeAccessBoundary>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
