import { ComponentPropsWithoutRef } from "react";

import { cn, getStrapiImgSrcSetAndSizes } from "~/lib/utils";
import { APIResponse } from "~/types/utils";

interface Props extends ComponentPropsWithoutRef<"img"> {
  asset: APIResponse<"plugin::upload.file"> | null | undefined;
}

export function StrapiImage({ asset, className, ...rest }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!asset?.data?.attributes?.url) {
    return null;
  }
  const formats = asset.data.attributes.formats;
  const baseUrl = typeof window === "undefined" ? process.env.STRAPI_URL : window.ENV.STRAPI_URL;
  const url = new URL(asset.data.attributes.url, baseUrl).toString();
  if (!formats) {
    return (
      <img
        src={url.toString()}
        width={asset.data.attributes.width}
        height={asset.data.attributes.height}
        {...rest}
        className={cn(className)}
      />
    );
  }

  const { srcSet, sizes } = getStrapiImgSrcSetAndSizes(formats);
  return (
    <img
      src={url.toString()}
      srcSet={srcSet}
      sizes={sizes}
      width={asset.data.attributes.width}
      height={asset.data.attributes.height}
      className={cn(className)}
      {...rest}
    />
  );
}
