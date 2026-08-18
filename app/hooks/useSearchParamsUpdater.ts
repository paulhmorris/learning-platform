import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";

/**
 * Applies a mutation to the query string, replacing the current entry.
 *
 * `setSearchParams(prev => ...)` hands back the params from the render that created the setter, and
 * the committed location lags a navigation while its loaders run. Either way an update fired a beat
 * later — from a debounce, or from another component — silently drops params written in between.
 * This composes against the in-flight navigation's params instead.
 */
export function useUpdateSearchParams() {
  const location = useLocation();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const pendingSearch =
    navigation.location?.pathname === location.pathname ? navigation.location.search : location.search;

  const searchRef = useRef(pendingSearch);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    searchRef.current = pendingSearch;
  }, [pendingSearch]);
  navigateRef.current = navigate;

  return useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchRef.current);
    mutate(params);
    const search = `?${params.toString()}`;
    searchRef.current = search;
    navigateRef.current(search, { replace: true, preventScrollReset: true });
  }, []);
}
