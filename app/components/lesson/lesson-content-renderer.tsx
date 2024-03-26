import { lazy } from "react";
import { StrapiResponse } from "strapi-sdk-js";
import { useIsClient } from "usehooks-ts";

// eslint-disable-next-line import/order
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "~/components/ui/carousel";
const MuxPlayer = lazy(() => import("@mux/mux-player-react"));
const BlocksRenderer = lazy(() =>
  import("@strapi/blocks-react-renderer").then((module) => ({ default: module.BlocksRenderer })),
);

import { getStrapiImgSrcSetAndSizes, useOptionalUser } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

type Props = {
  content: StrapiResponse<APIResponseData<"api::lesson.lesson">>["data"]["attributes"]["content"];
};

export function LessonContentRenderer({ content }: Props) {
  const user = useOptionalUser();

  const isClient = useIsClient();
  if (!isClient) {
    return null;
  }

  return (
    <div className="space-y-8">
      {content?.map((component, c_index) => {
        switch (component.__component) {
          case "blocks.video": {
            const video = component.mux_asset?.data.attributes;
            if (!video) {
              return null;
            }

            return (
              <MuxPlayer
                key={video.asset_id}
                streamType="on-demand"
                title={video.title}
                playbackId={video.playback_id}
                accentColor="#FFD703"
                style={{ borderRadius: "10px", overflow: "hidden" }}
                metadata={{
                  video_id: video.asset_id,
                  video_title: video.title,
                  viewer_user_id: user?.id,
                }}
              />
            );
          }

          case "blocks.text": {
            return (
              <section
                key={`${component.__component}-${component.id}`}
                data-key={`${component.__component}-${component.id}`}
                className="prose max-w-full dark:prose-invert prose-h1:text-[32px] prose-p:my-0 prose-p:text-lg prose-p:leading-7"
              >
                <BlocksRenderer content={component.content} />
              </section>
            );
          }

          case "blocks.slideshow": {
            return (
              <Carousel key={`carousel-${c_index}`} className="mx-12 max-w-[75%]">
                <CarouselContent>
                  {component.images.data.map((i, index) => {
                    return (
                      <CarouselItem key={`slideshow-image-${i.id}-${index}`}>
                        <div className="flex aspect-square items-center justify-center p-6">
                          <img src={`${window.ENV.STRAPI_URL}${i.attributes.url}`} alt={i.attributes.alternativeText} />
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            );
          }

          case "blocks.image": {
            const formats = component.asset?.data.attributes.formats;
            if (!component.asset?.data.attributes.url) {
              return null;
            }
            const baseUrl = typeof window === "undefined" ? process.env.STRAPI_URL : window.ENV.STRAPI_URL;
            const url = new URL(component.asset.data.attributes.url, baseUrl).toString();
            if (!formats) {
              return (
                <img
                  key={`${component.__component}-${component.id}`}
                  src={url.toString()}
                  alt={component.alt}
                  width={component.asset.data.attributes.width}
                  height={component.asset.data.attributes.height}
                />
              );
            }

            const { srcSet, sizes } = getStrapiImgSrcSetAndSizes(formats);
            return (
              <img
                key={`${component.__component}-${component.id}`}
                src={url.toString()}
                alt={component.alt}
                srcSet={srcSet}
                sizes={sizes}
                width={component.asset.data.attributes.width}
                height={component.asset.data.attributes.height}
              />
            );
          }

          case "blocks.audio": {
            const audio = component.asset?.data.attributes;
            if (!audio) {
              return null;
            }
            const baseUrl = typeof window === "undefined" ? process.env.STRAPI_URL : window.ENV.STRAPI_URL;
            const url = new URL(audio.url, baseUrl).toString();

            return (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls key={`${component.__component}-${component.id}`} className="w-full">
                <source src={url} type={audio.mime} />
              </audio>
            );
          }
        }
      })}
    </div>
  );
}
