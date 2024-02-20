import MuxPlayer from "@mux/mux-player-react";
import { BlocksRenderer } from "@strapi/blocks-react-renderer";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { cms } from "~/integrations/cms.server";
import { getStrapiImgSrcSetAndSizes, useOptionalUser } from "~/lib/utils";
import { APIResponseData } from "~/types/utils";

export async function loader() {
  const lesson = await cms.findOne<APIResponseData<"api::lesson.lesson">>("lessons", 1, {
    populate: {
      content: {
        populate: "*",
      },
    },
  });
  return typedjson({ lesson });
}

export default function Test() {
  const { lesson } = useTypedLoaderData<typeof loader>();
  const user = useOptionalUser();

  return (
    <div className="grid grid-cols-3 gap-8">
      <pre className="col-spand-1 max-w-2xl whitespace-pre-wrap rounded border-gray-500 bg-gray-50 p-6 text-xs">
        {JSON.stringify(lesson, null, 2)}
      </pre>
      <div className="col-span-2 h-full w-full bg-gray-50">
        <h1>{lesson.data.attributes.title}</h1>
        {lesson.data.attributes.content?.map((component) => {
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
                  metadata={{
                    video_id: video.asset_id,
                    video_title: video.title,
                    viewer_user_id: user?.id,
                  }}
                />
              );
            }

            case "blocks.text": {
              return <BlocksRenderer key={component.uuid} content={component.content} />;
            }

            case "blocks.image": {
              const formats = component.asset?.data.attributes.formats;

              if (!formats) {
                if (!component.asset?.data.attributes.url) {
                  return null;
                }

                const baseUrl = typeof window === "undefined" ? process.env.STRAPI_URL : window.ENV.STRAPI_URL;
                const url = new URL(component.asset.data.attributes.url, baseUrl).toString();
                return (
                  <img
                    key={component.uuid}
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
                  key={component.uuid}
                  src={component.asset?.data.attributes.url}
                  alt={component.alt}
                  srcSet={srcSet}
                  sizes={sizes}
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
                <audio controls key={component.uuid}>
                  <source src={url} type={audio.mime} />
                </audio>
              );
            }
          }
        })}
      </div>
    </div>
  );
}
