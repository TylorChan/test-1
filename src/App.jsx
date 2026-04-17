import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { AssistantDrawer } from './components/assistant-drawer.jsx'
import { ReportColumn } from './components/report-column.jsx'
import {
  assistantOpenAtom,
  dashboardAtom,
  dashboardErrorAtom,
  dashboardLoadingAtom,
  fetchDashboardAtom,
} from './atoms/report-atoms.js'

function App() {
  const dashboard = useAtomValue(dashboardAtom)
  const assistantOpen = useAtomValue(assistantOpenAtom)
  const dashboardError = useAtomValue(dashboardErrorAtom)
  const dashboardLoading = useAtomValue(dashboardLoadingAtom)
  const fetchDashboard = useSetAtom(fetchDashboardAtom)

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return (
    <main className="app-shell">
      <section className={`dashboard-layout ${assistantOpen ? 'dashboard-layout--split' : ''}`}>
        <ReportColumn dashboard={dashboard} error={dashboardError} isLoading={dashboardLoading} />
        {assistantOpen ? <div className="split-divider" /> : null}
        {assistantOpen ? <AssistantDrawer /> : null}
      </section>
    </main>
  )
}

export default App
