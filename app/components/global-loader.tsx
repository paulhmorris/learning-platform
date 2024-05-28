import { useFetchers, useNavigation } from "@remix-run/react";
import NProgress from "nprogress";
import { useEffect } from "react";

export function GlobalLoader() {
  const navigation = useNavigation();
  const fetchers = useFetchers();

  useEffect(() => {
    const fetchersIdle = fetchers.every((f) => f.state === "idle");
    NProgress.configure({ showSpinner: false });
    if (navigation.state === "idle" && fetchersIdle) {
      NProgress.done();
    } else {
      NProgress.start();
    }
  }, [navigation.state, fetchers]);

  return null;
}
