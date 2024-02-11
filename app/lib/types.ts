import type {
  LoaderFunctionArgs,
  SerializeFrom,
  ServerRuntimeMetaArgs,
  ServerRuntimeMetaDescriptor,
} from "@remix-run/server-runtime";
import type { TypedJsonResponse } from "remix-typedjson";

export type TypedMetaFunction<Loader extends (args: LoaderFunctionArgs) => Promise<TypedJsonResponse>> = (
  args: Omit<ServerRuntimeMetaArgs, "data"> & {
    data: SerializeFrom<PromiseReturnType<PromiseReturnType<Loader>["typedjson"]>> | undefined;
  },
) => Array<ServerRuntimeMetaDescriptor>;

type PromiseReturnType<T extends (...arguments_: any) => Promise<any>> = Awaited<Promise<ReturnType<T>>>;
