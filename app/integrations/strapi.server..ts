const config: RequestInit = {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
  },
};

const url = new URL(`${process.env.STRAPI_URL}/api`).toString();

export async function getEntries(pluralApiId: string) {
  const res = await fetch(`${url}/${pluralApiId}`, config);
  const data = (await res.json()) as StrapiResponse[];
  return data;
}

export async function getEntry(pluralApiId: string, id: string) {
  const res = await fetch(`${url}/${pluralApiId}/${id}`, config);
  const data = (await res.json()) as StrapiResponse;
  return data;
}

interface StrapiMetadata {
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
}

interface StrapiEntry<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  attributes: {
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
  } & T;
}

interface StrapiResponse<T extends Record<string, unknown> = Record<string, unknown>> {
  data: StrapiEntry<T>;
  meta: StrapiMetadata;
}
