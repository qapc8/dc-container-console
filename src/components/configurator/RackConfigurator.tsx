import { useConfigStore } from '../../store/configStore';
import { RackCard } from './RackCard';
import { ContainerSettings } from './ContainerSettings';
import { QuickFill } from './QuickFill';

export function RackConfigurator() {
  const racks = useConfigStore(s => s.racks);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <QuickFill />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {racks.map(rack => (
              <RackCard key={rack.id} rack={rack} />
            ))}
          </div>
        </div>
        <ContainerSettings />
      </div>
    </div>
  );
}
