import { AppShell } from './components/layout/AppShell';
import { PasswordGate } from './components/auth/PasswordGate';
import { RackConfigurator } from './components/configurator/RackConfigurator';
import { Dashboard } from './components/dashboard/Dashboard';
import { ContainerLayout } from './components/visualization/ContainerLayout';
import { CompareTab } from './components/comparison/CompareTab';
import { DataSourcesTab } from './components/sources/DataSourcesTab';
import { useUiStore } from './store/uiStore';

function App() {
  const activeTab = useUiStore(s => s.activeTab);

  return (
    <PasswordGate>
      <AppShell>
        {activeTab === 'configure' && <RackConfigurator />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'container' && <ContainerLayout />}
        {activeTab === 'compare' && <CompareTab />}
        {activeTab === 'sources' && <DataSourcesTab />}
      </AppShell>
    </PasswordGate>
  );
}

export default App;
