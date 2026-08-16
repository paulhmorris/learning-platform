// oxlint-disable-next-line import/no-unassigned-import
import "@total-typescript/ts-reset/filter-boolean";

declare module "react" {
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    fetchpriority?: "high" | "low" | "auto";
  }
}
