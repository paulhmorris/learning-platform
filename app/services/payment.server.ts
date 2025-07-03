import { stripe } from "~/integrations/stripe.server";
import { UserService } from "~/services/user.server";

type CreateCustomerOptions = {
  metadata?: Record<string, string>;
};

export const PaymentService = {
  async createCustomer(userId: string, options: CreateCustomerOptions = {}) {
    const user = await UserService.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const stripeCustomer = await stripe.customers.create({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      metadata: { ...options.metadata, user_id: userId },
    });
    await UserService.update(userId, { stripeId: stripeCustomer.id });
    return { id: stripeCustomer.id };
  },

  async createCourseCheckoutSession(userId: string, stripePriceId: string) {
    const success_url = new URL(
      "/purchase?success=true&session_id={CHECKOUT_SESSION_ID}",
      process.env.SITE_URL,
    ).toString();
    const cancel_url = new URL("/api/purchase?success=false", process.env.SITE_URL).toString();

    const user = await UserService.getById(userId);
    let stripeCustomerId = user?.stripeId ?? undefined;

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.stripeId) {
      const customer = await this.createCustomer(user.id);
      stripeCustomerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
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
