import { AxeBuilder } from "@axe-core/playwright";

import { test as authenticatedTest, expect } from "./authenticated";

type A11yFixtures = {
  makeAxeBuilder: () => AxeBuilder;
};

export const test = authenticatedTest.extend<A11yFixtures>({
  makeAxeBuilder: async ({ page }, use) => {
    const makeAxeBuilder = () => new AxeBuilder({ page });
    await use(makeAxeBuilder);
  },
});

export { expect };
