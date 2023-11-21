declare global {
  namespace NodeJS {
    interface ProcessEnv {
      STRIPE_SECRET_KEY: string;
      DATABASE_URL: string;
      SESSION_SECRET: string;
      STRAPI_TOKEN: string;
      STRAPI_URL: string;
    }
  }
}

export {};
