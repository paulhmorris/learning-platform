import { User } from "@prisma/client";

import { stripe } from "~/integrations/stripe.server";
import { UserService } from "~/services/user.server";

export const PaymentService = {
  async createCustomer(userId: User["id"]) {
    const user = await UserService.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const stripeCustomer = await stripe.customers.create({
      name: `${user.firstName}${user.lastName ? " " + user.lastName : ""}`,
      email: user.email,
      phone: user.phone ?? undefined,
      metadata: {
        user_id: user.id,
      },
    });
    const updatedUser = await UserService.update(user.id, { stripeId: stripeCustomer.id });
    return updatedUser as User & { stripeId: string };
  },

  async createCourseCheckoutSession(userId: User["id"], stripePriceId: string) {
    const success_url = new URL(
      "/purchase?success=true&session_id={CHECKOUT_SESSION_ID}",
      process.env.SITE_URL,
    ).toString();
    const cancel_url = new URL("/purchase?success=false", process.env.SITE_URL).toString();

    const user = await UserService.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.stripeId) {
      await this.createCustomer(user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: user.stripeId ?? undefined,
      mode: "payment",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url,
      cancel_url,
      metadata: {
        user_id: user.id,
      },
    });
    return session;
  },
};
