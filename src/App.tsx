import { Suspense, lazy } from 'react';
import { AppShell } from './components/layout/AppShell';
import { PasswordGate } from './components/auth/PasswordGate';
import { RackConfigurator } from './components/configurator/RackConfigurator';
import { Dashboard } from './components/dashboard/Dashboard';
import { ContainerLayout } from './components/visualization/ContainerLayout';
import { CompareTab } from './components/comparison/CompareTab';
import { DataSourcesTab } from './components/sources/DataSourcesTab';
import { useUiStore } from './store/uiStore';

const PodViewer = lazy(() => import('./components/pod3d/PodViewer'));

function App() {
  const activeTab = useUiStore(s => s.activeTab);

  return (
    <PasswordGate>
      <AppShell>
        {activeTab === 'configure' && <RackConfigurator />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'container' && <ContainerLayout />}
        {activeTab === 'pod-3d' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400">Loading 3D viewer...</div>}>
            <PodViewer />
          </Suspense>
        )}
        {activeTab === 'compare' && <CompareTab />}
        {activeTab === 'sources' && <DataSourcesTab />}
      </AppShell>
    </PasswordGate>
  );
}

export default App;
