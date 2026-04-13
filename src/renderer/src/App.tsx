import { ProjectsPage } from './routes/projects/ProjectsPage'
import { TasksPage } from './routes/tasks/TasksPage'
import { SamplesPage } from './routes/samples/SamplesPage'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { useEffect } from 'react'
import { LabelPage } from './routes/label/LabelPage'

const AllRoutes = () => {
  const navigate = useNavigate()

  useEffect(() => {
    window.navigate = navigate
  }, [navigate])

  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/tasks/:projectId" element={<TasksPage />} />
      <Route path="/samples/:taskId" element={<SamplesPage />} />
      <Route path="/label/:taskId" element={<LabelPage />} />
    </Routes>
  )
}
function App(): React.JSX.Element {
  return (
    <MemoryRouter>
      <AllRoutes />
    </MemoryRouter>
  )
}

export default App
