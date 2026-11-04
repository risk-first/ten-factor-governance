import { EnforcementLog } from '@gemara/react/enforcement-log';
import type { EnforcementLogData } from '@gemara/react';

export function EnforcementReceipt({
  data,
  headingLevel = 2,
}: {
  data: EnforcementLogData;
  headingLevel?: number;
}) {
  return (
    <EnforcementLog data={data} headingLevel={headingLevel}>
      <header data-gemara-part="header">
        <h2 data-gemara-part="title">{data.metadata.id}</h2>
        {data.disposition ? (
          <p data-gemara-part="result" data-gemara-disposition={data.disposition}>
            {data.disposition}
          </p>
        ) : null}
        <EnforcementLog.Header data={data} />
      </header>
      <EnforcementLog.Target data={data} />
      <EnforcementLog.Actions data={data} />
    </EnforcementLog>
  );
}
