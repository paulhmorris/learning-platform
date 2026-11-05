import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { AnyRealtimeRun } from "@trigger.dev/sdk/v3";
import { useEffect } from "react";

type Props = {
  runId: string;
  accessToken: string;
  onChange: (run: AnyRealtimeRun | undefined, error: Error | undefined) => void;
};

/** Reports updates for a trigger.dev run. Load with `React.lazy` to keep the realtime client out of server startup. */
export default function RealtimeRunWatcher({ runId, accessToken, onChange }: Props) {
  const { run, error } = useRealtimeRun(runId, { accessToken });

  useEffect(() => {
    onChange(run, error);
  }, [run, error, onChange]);

  return null;
}
